//! Writes frontmatter. An edit is spliced into the text the file already has:
//! keys whose values didn't change keep their text, comments and formatting,
//! and changed or new keys are rendered in the style of the rest of the block.
//! Every result is read back with `crate::yaml` before it's used, so the
//! splitting and rendering here decide how good the result looks, never
//! whether it's right (see `write_block`).

use std::sync::OnceLock;

use indexmap::IndexMap;
use regex::Regex;
use serde_json::Value;

use super::find_block;
use crate::yaml;

/// What a collection's schema says about its frontmatter, for writing it
#[derive(serde::Deserialize, specta::Type, Default)]
#[serde(rename_all = "camelCase")]
pub struct FrontmatterSchema {
    /// Field names in schema order, flattened (`seo.title`)
    pub fields: Vec<String>,
    /// The fields holding dates or lists of dates, flattened. Their values
    /// are written unquoted, so Astro reads them as dates
    pub date_fields: Vec<String>,
}

/// The frontmatter block for `values`, from the block the file has now
/// (`raw`, empty when it has none), as `MarkdownContent::raw_frontmatter`
/// holds it. With `reorder`, the keys are put in schema order, then the rest
/// alphabetically. The result must read back as exactly `values`: if the
/// spliced block doesn't, the whole block is rendered, and if that doesn't
/// either, it's an error and nothing should be written. Frontmatter that
/// can't be read is returned unchanged, since what it holds isn't known.
pub(crate) fn write_block(
    raw: &str,
    values: &IndexMap<String, Value>,
    schema: &FrontmatterSchema,
    reorder: bool,
) -> Result<String, String> {
    if raw.is_empty() && values.is_empty() {
        return Ok(String::new());
    }
    let lines: Vec<&str> = raw.lines().collect();
    let (opening, yaml_lines, closing, old) = if raw.is_empty() {
        (vec!["---"], vec![], "---", IndexMap::new())
    } else {
        let block = find_block(raw.lines()).ok_or("The frontmatter isn't a block")?;
        let Ok(old) = yaml::mapping(&block.yaml) else {
            return Ok(raw.to_string());
        };
        let last = lines.len() - 1;
        let yaml_lines = lines[block.yaml_line..last].to_vec();
        (
            lines[..block.yaml_line].to_vec(),
            yaml_lines,
            lines[last],
            old,
        )
    };

    let style = FileStyle::DEFAULT.within(&yaml_lines);
    let keys = key_order(&old, values, schema, reorder);
    let render = |key: &str, own_text: Option<&str>, written: &str| {
        render_entry(
            key,
            &values[key],
            own_text,
            written,
            style,
            &schema.date_fields,
        )
    };
    let reads_back = |yaml: &[String]| {
        let text: String = yaml.iter().map(|l| format!("{l}\n")).collect();
        yaml::mapping(&text).is_ok_and(|back| same_mapping(&back, values))
    };

    let yaml = match splice(&yaml_lines, &old, values, &keys, render) {
        Some(spliced) if reads_back(&spliced) => spliced,
        _ => {
            // Each key's own text isn't known, but how its values were written
            // can still be found in the whole block
            let old_yaml = yaml_lines.join("\n");
            let whole: Vec<String> = keys
                .iter()
                .flat_map(|key| {
                    let written = if old.contains_key(key) {
                        old_yaml.as_str()
                    } else {
                        ""
                    };
                    render(key, None, written)
                })
                .collect();
            if !reads_back(&whole) {
                return Err(
                    "Couldn't write the frontmatter so that it reads back as the values being saved"
                        .into(),
                );
            }
            whole
        }
    };
    let mut block = opening;
    block.extend(yaml.iter().map(String::as_str));
    block.push(closing);
    Ok(block.join("\n"))
}

/// The YAML with each changed or new key rendered, and every other key's
/// lines kept as written, in `keys`' order. `None` when it can't be split
/// into one entry for each key it had
fn splice(
    yaml_lines: &[&str],
    old: &IndexMap<String, Value>,
    values: &IndexMap<String, Value>,
    keys: &[String],
    render: impl Fn(&str, Option<&str>, &str) -> Vec<String>,
) -> Option<Vec<String>> {
    let Split {
        header,
        entries,
        trailer,
    } = split(yaml_lines)?;
    if entries.len() != old.len() || !entries.iter().all(|e| old.contains_key(&e.key)) {
        return None;
    }
    let mut out: Vec<String> = header.iter().map(|l| l.to_string()).collect();
    for key in keys {
        let Some(entry) = entries.iter().find(|e| &e.key == key) else {
            out.extend(render(key, None, ""));
            continue;
        };
        out.extend(entry.lead.iter().map(|l| l.to_string()));
        if same(&old[key], &values[key]) {
            out.extend(entry.lines.iter().map(|l| l.to_string()));
            continue;
        }
        let text = entry.lines.join("\n");
        let mut rendered = render(key, Some(&text), &text);
        // A one-line value keeps the comment after it
        let blank = entry
            .lines
            .iter()
            .rev()
            .take_while(|l| l.trim().is_empty())
            .count();
        if let ([line], [new_line]) = (&entry.lines[..entry.lines.len() - blank], &mut rendered[..])
        {
            if let Some(comment) = trailing_comment(line) {
                new_line.push_str(comment);
            }
        }
        out.extend(rendered);
        // And the blank lines that separated it from the next key
        out.extend(std::iter::repeat_n(String::new(), blank));
    }
    // Blank lines that separated a key that's been moved or deleted from the
    // next don't end up at the end of the block
    while out.last().is_some_and(|l| l.trim().is_empty()) && out.len() > header.len() {
        out.pop();
    }
    out.extend(trailer.iter().map(|l| l.to_string()));
    Some(out)
}

/// The comment at the end of a one-line `key: value`, with the space before
/// it, if it has one: the `#` that starts it is the one where the line reads
/// the same without what follows
fn trailing_comment(line: &str) -> Option<&str> {
    let whole = yaml::mapping(&format!("{line}\n")).ok()?;
    line.match_indices(" #")
        .map(|(at, _)| at)
        .find(|&at| yaml::mapping(&format!("{}\n", &line[..at])).is_ok_and(|m| m == whole))
        .map(|at| &line[at..])
}

/// A file put back together from its frontmatter block, MDX import block and
/// body, as `parse_frontmatter` split them
pub(crate) fn assemble(block: &str, imports: &str, content: &str) -> String {
    let mut result = String::new();
    if !block.is_empty() {
        // The block ends at the closing fence, without its line ending
        result.push_str(block);
        result.push('\n');
    }
    if !imports.trim().is_empty() {
        if !block.is_empty() {
            result.push('\n');
        }
        result.push_str(imports);
        if !imports.ends_with('\n') {
            result.push('\n');
        }
    }
    if !content.is_empty() {
        if !block.is_empty() || !imports.trim().is_empty() {
            result.push('\n');
        }
        result.push_str(content);
    }
    result
}

/// Whether two values are the same frontmatter. Numbers also compare as
/// floats: values make a round trip through JavaScript, which rounds
/// integers beyond 2^53, so one that comes back rounded still counts as
/// unchanged and keeps its text
fn same(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(a), Value::Number(b)) => a == b || a.as_f64() == b.as_f64(),
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| same(a, b))
        }
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len() && a.iter().all(|(k, v)| b.get(k).is_some_and(|w| same(v, w)))
        }
        _ => a == b,
    }
}

pub(super) fn same_mapping(a: &IndexMap<String, Value>, b: &IndexMap<String, Value>) -> bool {
    a.len() == b.len() && a.iter().all(|(k, v)| b.get(k).is_some_and(|w| same(v, w)))
}

// ---------------------------------------------------------------------------
// Key order

/// The order of the keys in `values`: the file's own order, with each new key
/// before the first key that comes after it in the schema, or else after the
/// last that comes before it, or else at the end. With reordering on, schema
/// keys in schema order and then the rest alphabetically. Nested objects keep
/// their own order
fn key_order(
    old: &IndexMap<String, Value>,
    values: &IndexMap<String, Value>,
    schema: &FrontmatterSchema,
    reorder: bool,
) -> Vec<String> {
    // Top-level keys in schema order: `seo.title` is under `seo`, unless the
    // frontmatter has a key with a dot in it
    let mut top: Vec<&str> = vec![];
    for field in &schema.fields {
        let key = if values.contains_key(field) {
            field.as_str()
        } else {
            field.split('.').next().unwrap_or(field)
        };
        if !top.contains(&key) {
            top.push(key);
        }
    }
    let position = |key: &str| top.iter().position(|t| *t == key);

    let mut keys: Vec<String> = old
        .keys()
        .filter(|k| values.contains_key(*k))
        .cloned()
        .collect();
    for key in values.keys().filter(|k| !old.contains_key(*k)) {
        let at = position(key)
            .and_then(|p| {
                let before = keys.iter().position(|k| position(k).is_some_and(|q| q > p));
                let after = keys
                    .iter()
                    .rposition(|k| position(k).is_some_and(|q| q < p));
                before.or(after.map(|i| i + 1))
            })
            .unwrap_or(keys.len());
        keys.insert(at, key.clone());
    }
    if reorder {
        keys.sort_by(|a, b| match (position(a), position(b)) {
            (Some(x), Some(y)) => x.cmp(&y),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => a.cmp(b),
        });
    }
    keys
}

// ---------------------------------------------------------------------------
// Splitting the YAML into top-level keys

/// One top-level key's lines
pub(super) struct Entry<'a> {
    pub(super) key: String,
    /// The comments at column 0 directly above the key, which move and go
    /// with it
    pub(super) lead: Vec<&'a str>,
    /// The key's own lines, then any blank lines after it, which can belong
    /// to its value (`|+` keeps trailing blank lines)
    pub(super) lines: Vec<&'a str>,
}

/// YAML split into one entry per top-level key
pub(super) struct Split<'a> {
    /// The blank and comment lines before the first key, which stay at the
    /// top whichever keys move or go
    pub(super) header: Vec<&'a str>,
    pub(super) entries: Vec<Entry<'a>>,
    /// The blank and comment lines after the last key
    pub(super) trailer: Vec<&'a str>,
}

/// A line that starts a top-level key: anything at column 0 except a
/// comment, a list item or the end of a flow collection. A quoted key counts
/// only with its colon, since a quoted value can also continue at column 0
fn starts_entry(line: &str) -> bool {
    let quoted_key = (line.starts_with('"') && line.contains("\":"))
        || (line.starts_with('\'') && line.contains("':"));
    quoted_key
        || !line.is_empty() && !line.starts_with([' ', '\t', '#', '-', ']', '}', ',', '"', '\''])
}

/// `None` unless each entry reads on its own as exactly one key (an alias to
/// an anchor in another entry doesn't)
pub(super) fn split<'a>(lines: &[&'a str]) -> Option<Split<'a>> {
    let mut header: Vec<&str> = vec![];
    let mut entries: Vec<Entry> = vec![];
    let mut pending: Vec<&str> = vec![];
    for &line in lines {
        if starts_entry(line) {
            // The comments after the last blank line lead this key; the rest
            // ends the key before
            let lead = match entries.last_mut() {
                Some(previous) => {
                    let comments = pending.iter().rposition(|l| l.trim().is_empty());
                    let lead = pending.split_off(comments.map_or(0, |i| i + 1));
                    previous.lines.append(&mut pending);
                    lead
                }
                None => {
                    header.append(&mut pending);
                    vec![]
                }
            };
            entries.push(Entry {
                key: String::new(),
                lead,
                lines: vec![line],
            });
        } else if line.trim().is_empty() || line.starts_with('#') {
            pending.push(line);
        } else {
            let entry = entries.last_mut()?;
            entry.lines.append(&mut pending);
            entry.lines.push(line);
        }
    }
    for entry in &mut entries {
        let map = yaml::mapping(&format!("{}\n", entry.lines.join("\n"))).ok()?;
        if map.len() != 1 {
            return None;
        }
        entry.key = map.keys().next()?.clone();
    }
    Some(Split {
        header,
        entries,
        trailer: pending,
    })
}

// ---------------------------------------------------------------------------
// Style

#[derive(Clone, Copy, PartialEq, Debug)]
enum Quote {
    Plain,
    Single,
    Double,
}

/// How a block's YAML is written, so new text can match it
#[derive(Clone, Copy)]
struct FileStyle {
    /// How far an object's keys sit in from its own key
    indent: usize,
    /// How far list items sit in from their key: 0 for `key:\n- a`
    list_indent: usize,
    /// How most of its strings are written
    quote: Quote,
}

impl FileStyle {
    /// Two-space indents and plain strings, the most common style
    const DEFAULT: Self = Self {
        indent: 2,
        list_indent: 2,
        quote: Quote::Plain,
    };

    /// This style, changed to how `lines` indent objects and lists (measured
    /// from the first key holding each) and write most of their strings,
    /// where they show it. Measured from the whole block, then from each
    /// key's own text, since a file's keys can differ: one list indented,
    /// another not
    fn within(self, lines: &[&str]) -> Self {
        let indent_of = |line: &str| line.len() - line.trim_start().len();
        let mut indent = None;
        let mut list_indent = None;
        for pair in lines.windows(2) {
            let (parent, child) = (pair[0], pair[1]);
            // A key whose value starts on the next line: `key:` or `- key:`
            let opens = parent.trim_end().ends_with(':') && !parent.trim_start().starts_with('#');
            if !opens || child.trim().is_empty() {
                continue;
            }
            let item = if parent.trim_start().starts_with("- ") {
                2
            } else {
                0
            };
            let (key_column, child_column) = (indent_of(parent) + item, indent_of(child));
            if child.trim_start().starts_with("- ") {
                list_indent.get_or_insert(child_column.saturating_sub(key_column));
            } else if child_column > key_column {
                indent.get_or_insert(child_column - key_column);
            }
        }
        Self {
            indent: indent.unwrap_or(self.indent),
            list_indent: list_indent.unwrap_or(self.list_indent),
            quote: prevailing_quote(&lines.join("\n")).unwrap_or(self.quote),
        }
    }
}
/// Each scalar in some YAML, after `key: `, `- `, `[` or `, `: its opening
/// quote, or the text of an unquoted one
fn scalar_start() -> &'static Regex {
    static SCALAR_START: OnceLock<Regex> = OnceLock::new();
    SCALAR_START.get_or_init(|| {
        Regex::new(r#"(?m)(?:^[ \t]*(?:-[ \t]+)*[^\s#][^:\n]*:[ \t]+|^[ \t]*-[ \t]+|[\[,][ \t]*)(["']|[^\s"'\[\]{}|>&*!#,][^,\]\n#]*)"#)
            .expect("valid regex")
    })
}

/// How most of the strings in some YAML are written, if it has any. Numbers,
/// booleans, nulls and dates are left out, since they're never quoted
fn prevailing_quote(yaml: &str) -> Option<Quote> {
    let (mut plain, mut single, mut double) = (0, 0, 0);
    for capture in scalar_start().captures_iter(yaml) {
        match capture[1].trim() {
            "\"" => double += 1,
            "'" => single += 1,
            text if is_other_type(text) || is_date_like(text) || text.parse::<f64>().is_ok() => {}
            _ => plain += 1,
        }
    }
    let most = plain.max(single).max(double);
    if most == 0 {
        None
    } else if plain == most {
        Some(Quote::Plain)
    } else if double == most {
        Some(Quote::Double)
    } else {
        Some(Quote::Single)
    }
}

// ---------------------------------------------------------------------------
// Rendering

/// What rendering one top-level key needs to know
struct Context<'a> {
    /// The file's style, as the key's own text shows it
    style: FileStyle,
    /// Text showing how the key's values were written: its own text, or the
    /// whole block when that isn't known. Empty for a new key
    written: &'a str,
    date_fields: &'a [String],
}

/// How `s` was written in `written` (see `Context`), if it's there: under
/// its own `key` first, so the same text written two ways under two keys is
/// told apart, then anywhere a value starts
fn written_as(written: &str, s: &str, key: Option<&str>) -> Option<Quote> {
    let under_key = key.map(|k| format!("{k}: "));
    let found = under_key
        .as_deref()
        .into_iter()
        .chain([": ", "- ", "[", ", "])
        .find_map(|before| written_after(written, before, s));
    found
}

/// How `s` is written straight after `before` in `yaml`, if it is
fn written_after(yaml: &str, before: &str, s: &str) -> Option<Quote> {
    if yaml.contains(&format!("{before}{}", double_quoted(s))) {
        Some(Quote::Double)
    } else if yaml.contains(&format!("{before}{}", single_quoted(s))) {
        Some(Quote::Single)
    } else if ends_a_value(yaml, &format!("{before}{s}")) {
        Some(Quote::Plain)
    } else {
        None
    }
}

/// Whether `text` appears in `yaml` followed by the end of a value: the end
/// of the line, `,`, `]` or a comment
fn ends_a_value(yaml: &str, text: &str) -> bool {
    yaml.match_indices(text).any(|(at, found)| {
        let rest = &yaml[at + found.len()..];
        rest.is_empty() || rest.starts_with(['\n', ',', ']']) || rest.starts_with(" #")
    })
}

/// Whether `written` (see `Context`) held an unquoted date where a value
/// goes: under its own `key` (written plain or quoted), or for a list item,
/// as any item. Astro read that as a date, so what replaces it is written as
/// one too, even when the schema doesn't say the field is a date (it may not
/// have been generated)
fn held_an_unquoted_date(written: &str, key: Option<&str>) -> bool {
    let uncommented = |v: &str| v.split(" #").next().unwrap_or(v).trim().to_string();
    let key_spellings = key.map(|k| [k.to_string(), double_quoted(k), single_quoted(k)]);
    written.lines().any(|line| {
        let line = line.trim_start().trim_start_matches("- ");
        match &key_spellings {
            Some(spellings) => spellings.iter().any(|key| {
                line.strip_prefix(key.as_str())
                    .and_then(|rest| rest.strip_prefix(": "))
                    .is_some_and(|v| is_date_like(&uncommented(v)))
            }),
            // A list item, in a block list or an inline one
            None => line
                .split(['[', ',', ']'])
                .any(|item| is_date_like(&uncommented(item.trim_start().trim_start_matches("- ")))),
        }
    })
}

/// The lines for `key` holding `value`, at the top level, given its own
/// lines when it had them, and text showing how its values were written. A
/// list that was written inline (`[a, b]`) stays inline, on the key's line or
/// the next, as it was
fn render_entry(
    key: &str,
    value: &Value,
    own_text: Option<&str>,
    written: &str,
    style: FileStyle,
    date_fields: &[String],
) -> Vec<String> {
    let context = Context {
        style: own_text.map_or(style, |o| style.within(&o.lines().collect::<Vec<_>>())),
        written,
        date_fields,
    };
    // What came between the key's colon and an inline list: a space, or a
    // line break and an indent
    let inline_list_after = own_text.and_then(|o| {
        let (_, value) = o.split_once(':')?;
        let list = value.trim_start();
        list.starts_with('[')
            .then(|| &value[..value.len() - list.len()])
    });
    if let (Some(separator), Value::Array(items)) = (inline_list_after, value) {
        if let Some(list) = inline_list(items, key, &context) {
            let text = format!("{}:{separator}{list}", render_key(key));
            return text.lines().map(String::from).collect();
        }
    }
    let mut out = vec![];
    entry(&mut out, 0, key, value, key, &context);
    out
}

/// Lines for `key: value` at `indent` spaces. `path` is the key's flattened
/// name, as the schema's date fields name it
fn entry(
    out: &mut Vec<String>,
    indent: usize,
    key: &str,
    value: &Value,
    path: &str,
    context: &Context,
) {
    let pad = " ".repeat(indent);
    let written_key = render_key(key);
    match value {
        Value::Object(map) if !map.is_empty() => {
            out.push(format!("{pad}{written_key}:"));
            for (k, v) in map {
                let path = format!("{path}.{k}");
                entry(out, indent + context.style.indent, k, v, &path, context);
            }
        }
        Value::Array(items) if !items.is_empty() => {
            out.push(format!("{pad}{written_key}:"));
            for item in items {
                list_item(out, indent + context.style.list_indent, item, path, context);
            }
        }
        Value::String(s) => {
            let (first, rest) = string_value(s, path, Some(key), context, indent);
            out.push(format!("{pad}{written_key}: {first}"));
            out.extend(rest);
        }
        _ => out.push(format!("{pad}{written_key}: {}", scalar(value))),
    }
}

/// Lines for a list item at `indent` spaces. An object's first key, or a
/// nested list's first item, goes on the item's own line
fn list_item(out: &mut Vec<String>, indent: usize, value: &Value, path: &str, context: &Context) {
    let pad = " ".repeat(indent);
    let mut nested = vec![];
    match value {
        Value::Object(map) if !map.is_empty() => {
            for (k, v) in map {
                entry(
                    &mut nested,
                    indent + 2,
                    k,
                    v,
                    &format!("{path}.{k}"),
                    context,
                );
            }
        }
        Value::Array(items) if !items.is_empty() => {
            for item in items {
                list_item(&mut nested, indent + 2, item, path, context);
            }
        }
        Value::String(s) => {
            let (first, rest) = string_value(s, path, None, context, indent);
            nested.push(format!("{pad}  {first}"));
            nested.extend(rest);
        }
        _ => nested.push(format!("{pad}  {}", scalar(value))),
    }
    nested[0] = format!("{pad}- {}", &nested[0][indent + 2..]);
    out.extend(nested);
}

/// A list of strings, numbers and booleans written inline, as `[a, b]`
fn inline_list(items: &[Value], path: &str, context: &Context) -> Option<String> {
    let items: Option<Vec<String>> = items
        .iter()
        .map(|item| match item {
            Value::String(s) if !s.contains('\n') => {
                Some(inline_string(s, path, None, context, true))
            }
            Value::Number(_) | Value::Bool(_) | Value::Null => Some(scalar(item)),
            _ => None,
        })
        .collect();
    Some(format!("[{}]", items?.join(", ")))
}

/// A number, boolean, null, or empty list or object
fn scalar(value: &Value) -> String {
    match value {
        Value::Array(_) => "[]".into(),
        Value::Object(_) => "{}".into(),
        other => other.to_string(),
    }
}

/// A key as written: plain when it reads back as itself, otherwise quoted
fn render_key(key: &str) -> String {
    let plain = !key.is_empty()
        && key.trim() == key
        && yaml::mapping(&format!("{key}: x\n")).is_ok_and(|m| m.len() == 1 && m.contains_key(key));
    if plain {
        key.to_string()
    } else {
        double_quoted(key)
    }
}

/// A string value: the text that goes after its key or `- `, and the lines
/// after that, which only a `|` block scalar has. Its content sits one
/// indent in from `indent`
fn string_value(
    s: &str,
    path: &str,
    key: Option<&str>,
    context: &Context,
    indent: usize,
) -> (String, Vec<String>) {
    if !s.contains('\n') {
        return (inline_string(s, path, key, context, false), vec![]);
    }
    block_scalar(s, indent + context.style.indent).unwrap_or_else(|| (double_quoted(s), vec![]))
}

/// A one-line string: as it was written in the original if it's there,
/// otherwise in the key's prevailing style, but only unquoted when that
/// reads back as the same string and no YAML reader would take it for
/// something else. A date-like string is unquoted only where it's a date: in
/// a date field, or where an unquoted date was before (see
/// `held_an_unquoted_date`), so Astro reads it as a date there and as text
/// everywhere else. A list item that was quoted stays quoted, since that
/// made it text even in a list of dates
fn inline_string(
    s: &str,
    path: &str,
    key: Option<&str>,
    context: &Context,
    in_list: bool,
) -> String {
    let written_as = written_as(context.written, s, key);
    let quoted_item = key.is_none() && matches!(written_as, Some(Quote::Single | Quote::Double));
    let date = is_date_like(s)
        && (context.date_fields.iter().any(|f| f == path)
            || (held_an_unquoted_date(context.written, key) && !quoted_item));
    let can_be_plain = reads_back_plain(s, in_list) && (!is_date_like(s) || date);
    if can_be_plain && date {
        return s.to_string();
    }
    match written_as.unwrap_or(context.style.quote) {
        Quote::Plain if can_be_plain => s.to_string(),
        Quote::Single if !s.chars().any(|c| c.is_control() && c != '\t') => single_quoted(s),
        _ => double_quoted(s),
    }
}

/// YAML 1.1's booleans and nulls, which some YAML readers still use, and the
/// spellings of infinity and NaN
fn is_other_type(s: &str) -> bool {
    static OTHER_TYPES: OnceLock<Regex> = OnceLock::new();
    OTHER_TYPES
        .get_or_init(|| {
            Regex::new(r"^(?:y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF|~|null|Null|NULL|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$")
                .expect("valid regex")
        })
        .is_match(s)
}

/// A timestamp as Astro's YAML reader recognises one
fn is_date_like(s: &str) -> bool {
    static DATE_LIKE: OnceLock<Regex> = OnceLock::new();
    DATE_LIKE
        .get_or_init(|| {
            Regex::new(r"^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}(?:(?:[Tt]|[ \t]+)[0-9]{1,2}:[0-9]{1,2}:[0-9]{1,2}(?:\.[0-9]+)?(?:[ \t]*(?:Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$")
                .expect("valid regex")
        })
        .is_match(s)
}

/// Whether `s` reads back as itself unquoted, as a value or as an item in an
/// inline list
fn reads_back_plain(s: &str, in_list: bool) -> bool {
    if s.is_empty() || s.trim() != s || s.chars().any(char::is_control) || is_other_type(s) {
        return false;
    }
    let expected = Value::String(s.to_string());
    if in_list {
        yaml::mapping(&format!("k: [{s}]\n"))
            .is_ok_and(|m| m.get("k") == Some(&Value::Array(vec![expected])))
    } else {
        yaml::mapping(&format!("k: {s}\n")).is_ok_and(|m| m.get("k") == Some(&expected))
    }
}

/// A multi-line string as a `|` block scalar with its content at `indent`
/// spaces, keeping its trailing newlines. `None` when that wouldn't read back
/// as the same string: when its first line starts with a space, which would
/// need an indentation indicator, or it holds control characters
fn block_scalar(s: &str, indent: usize) -> Option<(String, Vec<String>)> {
    let body = s.trim_end_matches('\n');
    let trailing = s.len() - body.len();
    let header = match trailing {
        0 => "|-",
        1 => "|",
        _ => "|+",
    };
    let content = |pad: &str| -> Vec<String> {
        body.split('\n')
            .map(|l| {
                if l.is_empty() {
                    String::new()
                } else {
                    format!("{pad}{l}")
                }
            })
            .chain(std::iter::repeat_n(
                String::new(),
                trailing.saturating_sub(1),
            ))
            .collect()
    };
    let check: String = std::iter::once(format!("k: {header}"))
        .chain(content("  "))
        .map(|l| l + "\n")
        .collect();
    let reads_back =
        yaml::mapping(&check).is_ok_and(|m| m.get("k") == Some(&Value::String(s.into())));
    reads_back.then(|| (header.to_string(), content(&" ".repeat(indent))))
}

fn double_quoted(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_default()
}

fn single_quoted(s: &str) -> String {
    format!("'{}'", s.replace('\'', "''"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn values(json: Value) -> IndexMap<String, Value> {
        serde_json::from_value(json).unwrap()
    }

    fn schema(fields: &[&str], date_fields: &[&str]) -> FrontmatterSchema {
        FrontmatterSchema {
            fields: fields.iter().map(|f| f.to_string()).collect(),
            date_fields: date_fields.iter().map(|f| f.to_string()).collect(),
        }
    }

    /// `raw` with its frontmatter edited to `new`, without a schema
    fn edit(raw: &str, new: Value) -> String {
        write_block(raw, &values(new), &FrontmatterSchema::default(), false).unwrap()
    }

    fn read(block: &str) -> IndexMap<String, Value> {
        yaml::mapping(&find_block(block.lines()).unwrap().yaml).unwrap()
    }

    #[test]
    fn keeps_the_text_of_keys_that_did_not_change() {
        let raw = "---\n# Notes on this post\ntitle: 'Old'\ntags: ['a', 'b'] # inline\nseo:\n    title: \"Search\"\n---";
        let written = edit(
            raw,
            json!({ "title": "New", "tags": ["a", "b"], "seo": { "title": "Search" } }),
        );
        assert_eq!(
            written,
            "---\n# Notes on this post\ntitle: 'New'\ntags: ['a', 'b'] # inline\nseo:\n    title: \"Search\"\n---"
        );
    }

    #[test]
    fn writes_a_changed_key_in_its_own_style() {
        let raw = "---\ndouble: \"a\"\nsingle: 'a'\nplain: a\ninline: ['a', 'b']\nindented:\n  - a\nflush:\n- a\nnested:\n    x: \"a\"\n    y: \"b\"\n---";
        let written = edit(
            raw,
            json!({
                "double": "b", "single": "it's", "plain": "b",
                "inline": ["a", "b", "c"], "indented": ["a", "b"], "flush": ["a", "b"],
                "nested": { "x": "a", "y": "c" },
            }),
        );
        assert_eq!(
            written,
            "---\ndouble: \"b\"\nsingle: 'it''s'\nplain: b\ninline: ['a', 'b', 'c']\nindented:\n  - a\n  - b\nflush:\n- a\n- b\nnested:\n    x: \"a\"\n    y: \"c\"\n---"
        );
    }

    #[test]
    fn keeps_an_inline_list_on_the_line_after_its_key() {
        let raw = "---\ntags:\n  ['a', 'b']\ndraft: true\n---";
        let written = edit(raw, json!({ "tags": ["a", "b", "c"], "draft": true }));
        assert_eq!(written, "---\ntags:\n  ['a', 'b', 'c']\ndraft: true\n---");
    }

    #[test]
    fn puts_new_keys_where_the_schema_does() {
        let raw = "---\ntitle: A\ncustom: x\ndraft: false\n---";
        let schema = schema(&["title", "pubDate", "draft", "tags"], &["pubDate"]);
        let new = values(json!({
            "title": "A", "custom": "x", "draft": false,
            "zebra": "z", "pubDate": "2024-01-15", "tags": ["a"],
        }));
        let written = write_block(raw, &new, &schema, false).unwrap();
        assert_eq!(
            written,
            "---\ntitle: A\ncustom: x\npubDate: 2024-01-15\ndraft: false\ntags:\n  - a\nzebra: z\n---"
        );
    }

    #[test]
    fn reorders_keys_with_their_text_and_comments() {
        let raw = "---\nzebra: z\n# About the title\ntitle: \"A\"\ndraft: false\napple: a\n---";
        let schema = schema(&["title", "draft"], &[]);
        let new = values(json!({ "zebra": "z", "title": "A", "draft": true, "apple": "a" }));
        let written = write_block(raw, &new, &schema, true).unwrap();
        assert_eq!(
            written,
            "---\n# About the title\ntitle: \"A\"\ndraft: true\napple: a\nzebra: z\n---"
        );
    }

    #[test]
    fn removes_a_deleted_key_with_its_comment() {
        let raw = "---\ntitle: A\n# The description\ndescription: B\ndraft: false\n---";
        let written = edit(raw, json!({ "title": "A", "draft": false }));
        assert_eq!(written, "---\ntitle: A\ndraft: false\n---");
    }

    #[test]
    fn writes_dates_unquoted_only_where_astro_should_read_dates() {
        let schema = schema(
            &["pubDate", "version", "event.date", "dates"],
            &["pubDate", "event.date", "dates"],
        );
        let new = values(json!({
            "pubDate": "2024-01-15",
            "version": "2024-01-15",
            "event": { "date": "2024-02-01T10:00:00Z" },
            "dates": ["2024-03-01"],
        }));
        let written = write_block("", &new, &schema, false).unwrap();
        assert_eq!(
            written,
            "---\npubDate: 2024-01-15\nversion: \"2024-01-15\"\nevent:\n  date: 2024-02-01T10:00:00Z\ndates:\n  - 2024-03-01\n---"
        );
    }

    #[test]
    fn keeps_an_unquoted_date_unquoted_when_its_object_is_rewritten() {
        // Without a schema, an unquoted date beside an edited key stays a date
        let raw = "---\nevent:\n  title: Launch\n  date: 2024-02-01\n  note: \"2024-02-01\"\n---";
        let written = edit(
            raw,
            json!({ "event": { "title": "Launch day", "date": "2024-02-01", "note": "2024-02-01" } }),
        );
        assert_eq!(
            written,
            "---\nevent:\n  title: Launch day\n  date: 2024-02-01\n  note: \"2024-02-01\"\n---"
        );
    }

    #[test]
    fn writes_multi_line_strings_as_block_scalars() {
        let new = values(json!({
            "none": "a\nb",
            "one": "a\nb\n",
            "two": "a\n\nb\n\n",
            "space": " indented\nline",
        }));
        let written = write_block("", &new, &FrontmatterSchema::default(), false).unwrap();
        assert_eq!(
            written,
            "---\nnone: |-\n  a\n  b\none: |\n  a\n  b\ntwo: |+\n  a\n\n  b\n\nspace: \" indented\\nline\"\n---"
        );
    }

    #[test]
    fn writes_every_string_so_it_reads_back_the_same() {
        let strings = [
            "",
            " ",
            "a: b",
            "a:b",
            "- x",
            "-x",
            "[x]",
            "{x}",
            "#x",
            "x #y",
            "x# y",
            "@x",
            "`x`",
            "'x'",
            "\"x\"",
            "it's",
            "say \"hi\"",
            "|",
            ">",
            "*x",
            "&x",
            "!x",
            "%x",
            "?x",
            ",x",
            "null",
            "~",
            "true",
            "True",
            "yes",
            "No",
            "on",
            "y",
            "1",
            "017",
            "1.10",
            "0x1F",
            "0o17",
            "1e3",
            "1_000",
            ".inf",
            "-.Inf",
            ".nan",
            "2024-01-15",
            "2024-01-15T10:00:00Z",
            "2024-01-15 10:00:00",
            " lead",
            "trail ",
            "tab\there",
            "back\\slash",
            "unicode ✨",
            "bell\u{7}",
            "\u{feff}bom",
            "multi\nline",
            "multi\nline\n",
            "multi\n\nline\n\n\n",
            " first space\nline",
            "\nstarts with a newline",
            "ends with spaces  \nnext",
            "<<",
            "---",
            "...",
            "a\r\nb",
        ];
        for s in strings {
            let new = values(json!({ "k": s, "list": [s], "nested": { "k": s } }));
            let written = write_block("", &new, &FrontmatterSchema::default(), false)
                .unwrap_or_else(|e| panic!("{s:?}: {e}"));
            assert!(
                same_mapping(&read(&written), &new),
                "{s:?} wrote\n{written}"
            );
        }
    }

    #[test]
    fn keeps_an_integer_javascript_rounded() {
        // JavaScript gives back 12345678901234567000
        let raw = "---\nid: 12345678901234567890\ntitle: A\n---";
        let written = edit(
            raw,
            json!({ "id": 12345678901234567890.0_f64, "title": "B" }),
        );
        assert_eq!(written, "---\nid: 12345678901234567890\ntitle: B\n---");
    }

    #[test]
    fn keeps_an_edited_date_a_date_where_it_was_one() {
        // Without a schema saying so, as when `astro sync` hasn't run
        let raw = "---\npubDate: 2024-01-15\nversion: \"2024-01-15\"\ndates:\n  - 2024-01-01\ninline: [2024-01-01]\nevents:\n  - name: Launch\n    date: 2024-01-15\n---";
        let written = edit(
            raw,
            json!({
                "pubDate": "2024-01-16",
                "version": "2024-01-16",
                "dates": ["2024-01-01", "2024-02-01"],
                "inline": ["2024-01-01", "2024-02-01"],
                "events": [
                    { "name": "Launch", "date": "2024-01-15" },
                    { "name": "Party", "date": "2024-03-01" },
                ],
            }),
        );
        assert_eq!(
            written,
            "---\npubDate: 2024-01-16\nversion: \"2024-01-16\"\ndates:\n  - 2024-01-01\n  - 2024-02-01\ninline: [2024-01-01, 2024-02-01]\nevents:\n  - name: Launch\n    date: 2024-01-15\n  - name: Party\n    date: 2024-03-01\n---"
        );
    }

    #[test]
    fn keeps_date_like_text_text_beside_dates() {
        // Without a schema: a quoted item in a list that also holds a date,
        // a field given the text of a date another field holds, and a date
        // under a quoted key
        let raw = "---\nvalues: [2024-01-01, \"2024-02-01\"]\nevent:\n  date: 2024-02-01\n  label: release\nlaunch:\n  \"date\": 2024-03-01\n  label: party\n---";
        let written = edit(
            raw,
            json!({
                "values": ["2024-01-01", "2024-02-01", "other"],
                "event": { "date": "2024-02-01", "label": "2024-02-01" },
                "launch": { "date": "2024-03-01", "label": "big party" },
            }),
        );
        assert_eq!(
            written,
            "---\nvalues: [2024-01-01, \"2024-02-01\", \"other\"]\nevent:\n  date: 2024-02-01\n  label: \"2024-02-01\"\nlaunch:\n  date: 2024-03-01\n  label: big party\n---"
        );
    }

    #[test]
    fn keeps_dates_when_writing_the_whole_block() {
        // The alias can't be split off, so the block is written whole
        let raw = "---\ntitle: Hello\nauthor: &me Danny\neditor: *me\nupdated: 2024-02-01\nnote: \"2024-02-01\"\n---";
        assert_eq!(
            edit(
                raw,
                json!({ "title": "Hello", "author": "Danny", "editor": "Danny", "updated": "2024-03-01", "note": "2024-02-01" })
            ),
            "---\ntitle: Hello\nauthor: Danny\neditor: Danny\nupdated: 2024-03-01\nnote: \"2024-02-01\"\n---"
        );
    }

    #[test]
    fn keeps_the_comments_at_the_top_at_the_top() {
        let raw = "---\n# yaml-language-server: $schema=schema.json\n\ntitle: A\ndraft: true\n---";
        assert_eq!(
            edit(raw, json!({ "draft": true })),
            "---\n# yaml-language-server: $schema=schema.json\n\ndraft: true\n---"
        );
        let reordered = write_block(
            raw,
            &values(json!({ "title": "A", "draft": false })),
            &schema(&["draft", "title"], &[]),
            true,
        )
        .unwrap();
        assert_eq!(
            reordered,
            "---\n# yaml-language-server: $schema=schema.json\n\ndraft: false\ntitle: A\n---"
        );
    }

    #[test]
    fn keeps_the_comment_after_an_edited_value() {
        let raw = "---\ndraft: true # remove before publishing\ntitle: 'A # not a comment' # working title\n---";
        assert_eq!(
            edit(raw, json!({ "draft": false, "title": "B # still not" })),
            "---\ndraft: false # remove before publishing\ntitle: 'B # still not' # working title\n---"
        );
    }

    #[test]
    fn leaves_no_blank_lines_where_a_deleted_key_was() {
        let raw = "---\ntitle: A\n\ndraft: true\n---";
        assert_eq!(edit(raw, json!({ "title": "A" })), "---\ntitle: A\n---");
    }

    #[test]
    fn writes_a_new_key_in_the_file_s_quote_style() {
        // Dates, numbers and booleans don't count: they're never quoted
        let raw = "---\ntitle: \"A\"\ndescription: \"B\"\npubDate: 2024-01-15\ncount: 3\ndraft: false\n---";
        let written = edit(
            raw,
            json!({ "title": "A", "description": "B", "pubDate": "2024-01-15", "count": 3, "draft": false, "author": "Danny" }),
        );
        assert!(written.ends_with("author: \"Danny\"\n---"), "{written}");
    }

    #[test]
    fn never_writes_over_frontmatter_it_cannot_read() {
        let raw = "---\ntitle: [unclosed\n---";
        assert_eq!(edit(raw, json!({ "title": "New" })), raw);
    }

    #[test]
    fn keeps_what_comes_before_and_after_the_yaml() {
        let raw = "\u{feff}\n--- \ntitle: A\n\n# The end\n---  ";
        assert_eq!(
            edit(raw, json!({ "title": "B" })),
            "\u{feff}\n--- \ntitle: B\n\n# The end\n---  "
        );
    }

    #[test]
    fn writes_lists_of_objects_and_nested_lists() {
        let new = values(json!({
            "actions": [{ "text": "Go", "link": "/go/" }, { "text": "Stop" }],
            "grid": [["a", "b"], ["c"]],
            "empty": { "list": [], "object": {} },
        }));
        let written = write_block("", &new, &FrontmatterSchema::default(), false).unwrap();
        assert_eq!(
            written,
            "---\nactions:\n  - text: Go\n    link: /go/\n  - text: Stop\ngrid:\n  - - a\n    - b\n  - - c\nempty:\n  list: []\n  object: {}\n---"
        );
    }

    #[test]
    fn falls_back_to_writing_the_whole_block() {
        // An alias to another key's anchor can't be split off, so the block is
        // written whole, with the alias's value written out
        let raw = "---\nauthor: &me Danny\neditor: *me\ntitle: A\n---";
        assert_eq!(
            edit(
                raw,
                json!({ "author": "Danny", "editor": "Danny", "title": "B" })
            ),
            "---\nauthor: Danny\neditor: Danny\ntitle: B\n---"
        );
    }

    #[test]
    fn writes_no_block_for_no_values_and_keeps_an_emptied_one() {
        assert_eq!(edit("", json!({})), "");
        assert_eq!(
            edit("---\ntitle: A\n# Kept\n---", json!({})),
            "---\n# Kept\n---"
        );
    }

    #[test]
    fn quotes_keys_that_need_it() {
        let written = edit("", json!({ "plain-key": 1, "null": 2, "a: b": 3, "": 4 }));
        assert_eq!(
            written,
            "---\nplain-key: 1\n\"null\": 2\n\"a: b\": 3\n\"\": 4\n---"
        );
    }

    #[test]
    fn assembles_a_file_from_its_parts() {
        assert_eq!(
            assemble("---\na: 1\n---", "", "Body\n"),
            "---\na: 1\n---\n\nBody\n"
        );
        assert_eq!(
            assemble("", "import A from './A'", "Body"),
            "import A from './A'\n\nBody"
        );
        assert_eq!(
            assemble("---\n---", "import A from './A'\n", ""),
            "---\n---\n\nimport A from './A'\n"
        );
        assert_eq!(assemble("", "", "Body"), "Body");
    }
}
