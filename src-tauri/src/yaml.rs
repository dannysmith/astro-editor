//! Reads YAML the way Astro does. Every YAML read in the app comes through
//! here (frontmatter, the file listings and `file()` collections), so they
//! can't read the same text differently. Clippy's `disallowed-methods` keeps
//! serde-saphyr's own functions out of the rest of the crate.
//!
//! Astro 7 reads frontmatter with the `yaml` package: YAML 1.2's core schema,
//! plus timestamps and merge keys. The options below match it, which the
//! corpus in `test/frontmatter/` checks (its README says how to compare with
//! Astro itself). Unquoted dates and datetimes come through as the strings
//! they're written as; the schema says which fields are dates.
//!
//! serde-saphyr is pinned to an exact version: see `Cargo.toml`.
#![allow(clippy::disallowed_methods)]

use indexmap::IndexMap;
use serde::de::DeserializeOwned;
use serde_json::Value;
use serde_saphyr::{Budget, DuplicateKeyPolicy, MergeKeyPolicy, NonFiniteFloatPolicy, Options};

/// Why YAML couldn't be read, and where
#[derive(Debug, Clone, PartialEq)]
pub struct YamlError {
    pub message: String,
    /// 1-based, when the parser knows where
    pub line: Option<u64>,
    pub column: Option<u64>,
}

impl YamlError {
    /// The same error, with its line counted `lines` further down: for YAML
    /// that starts partway through a file
    pub fn shifted(self, lines: u64) -> Self {
        Self {
            line: self.line.map(|line| line + lines),
            ..self
        }
    }
}

impl std::fmt::Display for YamlError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match (self.line, self.column) {
            (Some(line), Some(column)) => {
                write!(f, "{} at line {line}, column {column}", self.message)
            }
            _ => f.write_str(&self.message),
        }
    }
}

fn options() -> Options {
    let mut options = serde_saphyr::options! {
        // `yes`, `no`, `on` and `off` are strings in YAML 1.2
        strict_booleans: true,
        // `1_000` is a string in YAML 1.2's core schema
        underscored_numbers_as_strings: true,
        // Astro fails the build on duplicate keys
        duplicate_keys: DuplicateKeyPolicy::Error,
        merge_keys: MergeKeyPolicy::Merge,
        // `.inf` and `.nan` don't fail the whole document
        non_finite_float_policy: NonFiniteFloatPolicy::AsString,
    };
    // Errors are shown to writers, and logged, so they don't quote the file
    options.with_snippet = false;
    // Large `file()` collections need more nodes than the default allows. The
    // input size and the alias limits still bound the work
    let mut budget = Budget::default();
    budget.max_events = usize::MAX;
    budget.max_nodes = usize::MAX;
    options.budget = Some(budget);
    options
}

fn read<T: DeserializeOwned>(yaml: &str) -> Result<Option<T>, YamlError> {
    serde_saphyr::from_str_with_options(yaml, options()).map_err(|error| {
        let location = error.location();
        let (line, column) = (location.map(|l| l.line()), location.map(|l| l.column()));
        // The message ends with where the error is. It's kept apart, so
        // `shifted` can renumber the line, and `Display` puts it back
        let mut message = error.to_string();
        if let (Some(line), Some(column)) = (line, column) {
            let suffix = format!(" at line {line}, column {column}");
            if let Some(stripped) = message.strip_suffix(&suffix) {
                message = stripped.to_string();
            }
        }
        // A hint meant for developers
        if let Some((key, _)) = message.split_once(", set DuplicateKeyPolicy") {
            message = key.to_string();
        }
        YamlError {
            message,
            line,
            column,
        }
    })
}

/// The mapping `yaml` holds, as frontmatter is read: empty when there's
/// nothing in it but comments
pub fn mapping(yaml: &str) -> Result<IndexMap<String, Value>, YamlError> {
    let mut map: IndexMap<String, Value> = read(yaml)?.unwrap_or_default();
    map.values_mut().for_each(as_javascript_numbers);
    Ok(map)
}

/// Any value `yaml` holds, as `file()` collections are read
pub fn value(yaml: &str) -> Result<Value, YamlError> {
    let mut value = read(yaml)?.unwrap_or(Value::Null);
    as_javascript_numbers(&mut value);
    Ok(value)
}

/// Numbers as JavaScript, and so Astro, sees them: a float with no fraction is
/// an integer. serde-saphyr reads an integer with a leading zero (`017`) as a
/// float, which would otherwise show as `17.0`, and give a `file()` entry
/// with `id: 007` the id `7.0`
fn as_javascript_numbers(value: &mut Value) {
    // The largest integer JavaScript holds exactly
    const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;
    match value {
        Value::Number(n) if n.is_f64() => {
            let f = n.as_f64().unwrap_or(f64::NAN);
            if f.fract() == 0.0 && f.abs() <= MAX_SAFE_INTEGER {
                *value = Value::from(f as i64);
            }
        }
        Value::Array(items) => items.iter_mut().for_each(as_javascript_numbers),
        Value::Object(map) => map.values_mut().for_each(as_javascript_numbers),
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn read_mapping(yaml: &str) -> Value {
        Value::Object(mapping(yaml).unwrap().into_iter().collect())
    }

    #[test]
    fn reads_scalars_as_yaml_1_2_core_schema() {
        let values = read_mapping(
            "yes: yes\nno: no\non: on\ncapital: True\nhex: 0x10\noctal: 0o17\nleadingZero: 017\nunderscored: 1_000\nfloat: 1.5\nwhole: 1.0\nexponent: 1e3\nnothing: ~\nempty:\n",
        );
        assert_eq!(
            values,
            json!({
                "yes": "yes", "no": "no", "on": "on", "capital": true,
                "hex": 16, "octal": 15, "leadingZero": 17, "underscored": "1_000",
                "float": 1.5, "whole": 1, "exponent": 1000,
                "nothing": null, "empty": null,
            })
        );
    }

    #[test]
    fn keeps_dates_as_the_text_they_were_written_as() {
        let values = read_mapping(
            "date: 2024-01-15\ndatetime: 2024-01-15T10:00:00Z\nquoted: \"2024-01-15\"\n",
        );
        assert_eq!(
            values,
            json!({ "date": "2024-01-15", "datetime": "2024-01-15T10:00:00Z", "quoted": "2024-01-15" })
        );
    }

    #[test]
    fn applies_merge_keys_and_rejects_duplicate_keys() {
        let values = read_mapping("base: &base\n  a: 1\npage:\n  <<: *base\n  b: 2\n");
        assert_eq!(values["page"], json!({ "a": 1, "b": 2 }));

        let error = mapping("title: a\ntitle: b\n").unwrap_err();
        assert_eq!(
            error.to_string(),
            "duplicate mapping key: title at line 2, column 1"
        );
    }

    #[test]
    fn errors_say_where_and_can_be_shifted() {
        let error = mapping("title: [unclosed\n").unwrap_err();
        assert_eq!((error.line, error.column), (Some(1), Some(8)));
        assert_eq!(error.clone().shifted(1).line, Some(2));
        assert!(!error.message.contains("at line"), "{}", error.message);
    }

    #[test]
    fn reads_nothing_as_nothing() {
        assert!(mapping("").unwrap().is_empty());
        assert!(mapping("# Only a comment\n").unwrap().is_empty());
        assert_eq!(value("").unwrap(), Value::Null);
    }

    #[test]
    fn reads_large_collections() {
        let yaml: String = (0..40_000)
            .map(|i| format!("- id: entry-{i}\n  title: Entry {i}\n  tags: [a, b]\n"))
            .collect();
        assert_eq!(value(&yaml).unwrap().as_array().unwrap().len(), 40_000);
    }

    #[test]
    fn reads_ids_with_leading_zeros_as_javascript_does() {
        assert_eq!(value("- id: 007\n").unwrap(), json!([{ "id": 7 }]));
    }
}
