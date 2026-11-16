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
    let lines: Vec<&str> = raw.lines().collect();
    let (opening, yaml_lines, closing, old) = if raw.is_empty() {
        (vec!["---"], vec![], "---", IndexMap::new())
    } else {
        let block = find_block(raw.lines()).ok_or("The frontmatter isn't a block")?;
        let Ok(old) = yaml::mapping(&block.yaml) else {
            return Ok(raw.to_string());
        };
        let yaml_lines = lines[block.yaml_line..lines.len() - 1].to_vec();
        (
            lines[..block.yaml_line].to_vec(),
            yaml_lines,
            lines[lines.len() - 1],
            old,
        )
    };
    if raw.is_empty() && values.is_empty() {
        return Ok(String::new());
    }

    let style = FileStyle::of(&yaml_lines);
    let keys = key_order(&old, values, schema, reorder);
    let render = |key: &str, original: Option<&str>| {
        render_entry(key, &values[key], original, &style, &schema.date_fields)
    };

    let spliced = split(&yaml_lines)
        .filter(|(entries, _)| {
            entries.len() == old.len() && entries.iter().all(|e| old.contains_key(&e.key))
        })
        .map(|(entries, trailer)| {
            let mut out: Vec<String> = vec![];
            for key in &keys {
                match entries.iter().find(|e| &e.key == key) {
                    Some(entry) => {
                        out.extend(entry.lead.iter().map(|l| l.to_string()));
                        if same(&old[key], &values[key]) {
                            out.extend(entry.lines.iter().map(|l| l.to_string()));
                        } else {
                            out.extend(render(key, Some(&entry.lines.join("\n"))));
                            // Keep the blank lines that separated it from the next key
                            let blank =
                                entry.lines.iter().rev().take_while(|l| l.trim().is_empty());
                            out.extend(blank.map(|l| l.to_string()));
                        }
                    }
                    None => out.extend(render(key, None)),
                }
            }
            out.extend(trailer.iter().map(|l| l.to_string()));
            out
        });
    let whole = || {
        keys.iter()
            .flat_map(|key| render(key, None))
            .collect::<Vec<_>>()
    };

    for yaml in spliced.into_iter().chain(std::iter::once_with(whole)) {
        let text = yaml.iter().map(|l| format!("{l}\n")).collect::<String>();
        if yaml::mapping(&text).is_ok_and(|back| same_mapping(&back, values)) {
            let mut block: Vec<&str> = opening.clone();
            block.extend(yaml.iter().map(String::as_str));
            block.push(closing);
            return Ok(block.join("\n"));
        }
    }
    Err("Couldn't write the frontmatter so that it reads back as the values being saved".into())
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

/// Whether two values are the same frontmatter. Numbers compare by value,
/// since values make a round trip through JavaScript, where `1.0` is `1`, and
/// objects ignore key order
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
    // Top-level keys in schema order: `seo.title` is under `seo`
    let mut top: Vec<&str> = vec![];
    for field in &schema.fields {
        let key = field.split('.').next().unwrap_or(field);
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
    /// with it. Above the first key, any blank lines too
    pub(super) lead: Vec<&'a str>,
    /// The key's own lines, then any blank lines after it, which can belong
    /// to its value (`|+` keeps trailing blank lines)
    pub(super) lines: Vec<&'a str>,
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

/// The YAML split into one entry per top-level key, and the blank and comment
/// lines after the last one. `None` unless each entry reads on its own as
/// exactly one key (an alias to an anchor in another entry doesn't)
pub(super) fn split<'a>(lines: &[&'a str]) -> Option<(Vec<Entry<'a>>, Vec<&'a str>)> {
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
                None => std::mem::take(&mut pending),
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
    Some((entries, pending))
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
    /// Measured from the whole block, with two-space indents when it has no
    /// objects or lists to measure (the most common style)
    fn of(lines: &[&str]) -> Self {
        let (indent, list_indent, quote) = measure(lines);
        Self {
            indent: indent.unwrap_or(2),
            list_indent: list_indent.unwrap_or(2),
            quote: quote.unwrap_or(Quote::Plain),
        }
    }

    /// The style of one key's original text, where it shows one, since a
    /// file's keys can differ: one list indented, another not
    fn within(self, original: Option<&str>) -> Self {
        let Some(original) = original else {
            return self;
        };
        let (indent, list_indent, quote) = measure(&original.lines().collect::<Vec<_>>());
        Self {
            indent: indent.unwrap_or(self.indent),
            list_indent: list_indent.unwrap_or(self.list_indent),
            quote: quote.unwrap_or(self.quote),
        }
    }
}

/// How some YAML indents objects and lists, from the first key holding each,
/// and how most of its strings are written: whatever it shows
fn measure(lines: &[&str]) -> (Option<usize>, Option<usize>, Option<Quote>) {
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
    (indent, list_indent, prevailing_quote(&lines.join("\n")))
}

/// The start of each scalar in some YAML: after `key: `, `- `, `[` or `, `
fn scalar_start() -> &'static Regex {
    static SCALAR_START: OnceLock<Regex> = OnceLock::new();
    SCALAR_START.get_or_init(|| {
        Regex::new(r#"(?m)(?:^[ \t]*(?:-[ \t]+)*[^\s#][^:\n]*:[ \t]+|^[ \t]*-[ \t]+|[\[,][ \t]*)(["']|[^\s"'\[\]{}|>&*!#,])"#)
            .expect("valid regex")
    })
}

/// How most of the strings in some YAML are written, if it has any
fn prevailing_quote(yaml: &str) -> Option<Quote> {
    let (mut plain, mut single, mut double) = (0, 0, 0);
    for capture in scalar_start().captures_iter(yaml) {
        match &capture[1] {
            "\"" => double += 1,
            "'" => single += 1,
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
    /// The key's text as it was, when it was in the file
    original: Option<&'a str>,
    /// The key was a list written inline (`[a, b]`): on the key's own line,
    /// or on the next
    inline_list: Option<InlineList>,
    date_fields: &'a [String],
}

#[derive(Clone, Copy, PartialEq)]
enum InlineList {
    OnTheKeysLine,
    OnTheNextLine,
}

impl Context<'_> {
    /// How `s` was written in the key's original text, if it's there: under
    /// `key` first, so the same text written two ways under two keys is told
    /// apart
    fn written_as(&self, s: &str, key: Option<&str>) -> Option<Quote> {
        let original = self.original?;
        if let Some(quote) = key.and_then(|key| written_after(original, &format!("{key}: "), s)) {
            return Some(quote);
        }
        if original.contains(&double_quoted(s)) {
            Some(Quote::Double)
        } else if original.contains(&single_quoted(s)) {
            Some(Quote::Single)
        } else if [": ", "- ", "[", ", "]
            .iter()
            .any(|b| ends_a_value(original, &format!("{b}{s}")))
        {
            Some(Quote::Plain)
        } else {
            None
        }
    }
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

/// The lines for `key` holding `value`, at the top level
fn render_entry(
    key: &str,
    value: &Value,
    original: Option<&str>,
    style: &FileStyle,
    date_fields: &[String],
) -> Vec<String> {
    // What follows the key's colon, on its line and on the next
    let after_colon = original.and_then(|o| o.split_once(':')).map(|(_, v)| v);
    let inline_list = after_colon.and_then(|v| {
        let (same_line, rest) = v.split_once('\n').unwrap_or((v, ""));
        let next_line = rest.lines().next().unwrap_or("");
        if same_line.trim_start().starts_with('[') {
            Some(InlineList::OnTheKeysLine)
        } else if same_line.trim().is_empty() && next_line.trim_start().starts_with('[') {
            Some(InlineList::OnTheNextLine)
        } else {
            None
        }
    });
    let context = Context {
        style: style.within(original),
        original,
        inline_list,
        date_fields,
    };
    let mut out = vec![];
    entry(&mut out, 0, key, value, key, &context, true);
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
    top: bool,
) {
    let pad = " ".repeat(indent);
    let written_key = render_key(key);
    match value {
        Value::Object(map) if !map.is_empty() => {
            out.push(format!("{pad}{written_key}:"));
            for (k, v) in map {
                let path = format!("{path}.{k}");
                entry(
                    out,
                    indent + context.style.indent,
                    k,
                    v,
                    &path,
                    context,
                    false,
                );
            }
        }
        Value::Array(items) if !items.is_empty() => {
            let inline = match context.inline_list {
                Some(place) if top => inline_list(items, path, context).map(|list| (place, list)),
                _ => None,
            };
            match inline {
                Some((InlineList::OnTheKeysLine, list)) => {
                    out.push(format!("{pad}{written_key}: {list}"));
                }
                Some((InlineList::OnTheNextLine, list)) => {
                    let inner = " ".repeat(indent + context.style.indent);
                    out.push(format!("{pad}{written_key}:"));
                    out.push(format!("{inner}{list}"));
                }
                None => {
                    out.push(format!("{pad}{written_key}:"));
                    for item in items {
                        list_item(out, indent + context.style.list_indent, item, path, context);
                    }
                }
            }
        }
        Value::String(s) => match string(s, path, Some(key), context, indent) {
            Text::Inline(text) => out.push(format!("{pad}{written_key}: {text}")),
            Text::Block(header, lines) => {
                out.push(format!("{pad}{written_key}: {header}"));
                out.extend(lines);
            }
        },
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
                    false,
                );
            }
        }
        Value::Array(items) if !items.is_empty() => {
            for item in items {
                list_item(&mut nested, indent + 2, item, path, context);
            }
        }
        Value::String(s) => match string(s, path, None, context, indent) {
            Text::Inline(text) => nested.push(format!("{pad}  {text}")),
            Text::Block(header, lines) => {
                nested.push(format!("{pad}  {header}"));
                nested.extend(lines);
            }
        },
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

enum Text {
    Inline(String),
    /// A `|` block scalar: its header and its lines
    Block(String, Vec<String>),
}

fn string(s: &str, path: &str, key: Option<&str>, context: &Context, indent: usize) -> Text {
    if s.contains('\n') {
        if let Some((header, lines)) = block_scalar(s, indent + context.style.indent) {
            return Text::Block(header, lines);
        }
        return Text::Inline(double_quoted(s));
    }
    Text::Inline(inline_string(s, path, key, context, false))
}

/// A one-line string: as it was written in the original if it's there,
/// otherwise in the key's prevailing style, but only unquoted when that
/// reads back as the same string and no YAML reader would take it for
/// something else. A date-like string is unquoted only in a date field or
/// where it was unquoted before, so Astro reads it as a date there and as
/// text everywhere else
fn inline_string(
    s: &str,
    path: &str,
    key: Option<&str>,
    context: &Context,
    in_list: bool,
) -> String {
    let written_as = context.written_as(s, key);
    let date_field = context.date_fields.iter().any(|f| f == path);
    let can_be_plain = reads_back_plain(s, in_list)
        && (!is_date_like(s) || date_field || written_as == Some(Quote::Plain));
    if can_be_plain && date_field && is_date_like(s) {
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
/// as the same string, including when its first line starts with a space,
/// which would need an indentation indicator
fn block_scalar(s: &str, indent: usize) -> Option<(String, Vec<String>)> {
    let body = s.trim_end_matches('\n');
    let starts_with_space = body
        .lines()
        .find(|l| !l.is_empty())
        .is_some_and(|l| l.starts_with(' '));
    if starts_with_space || s.chars().any(|c| c.is_control() && c != '\n' && c != '\t') {
        return None;
    }
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
    fn keeps_keys_whose_numbers_only_look_different() {
        // JavaScript turns `1.0` into `1`
        let raw = "---\nrating: 1.0\ntitle: A\n---";
        let written = edit(raw, json!({ "rating": 1, "title": "B" }));
        assert_eq!(written, "---\nrating: 1.0\ntitle: B\n---");
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
