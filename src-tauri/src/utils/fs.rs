//! Writing files without anyone seeing them half written.

use std::fs;
use std::io::{self, Write};
use std::path::Path;

/// Writes `contents` to `path` in one step: to a hidden file beside it, which
/// is then renamed over it. `fs::write` empties the file and then writes it,
/// so anything reading in between (AE reloading the open file after a change,
/// Astro's dev server, `git add`) would get an empty file, and AE could then
/// save that emptiness back. A rename is atomic, so readers see the old text
/// or the new. The data is flushed to disk before the rename. The file's
/// permissions are kept, and a read-only file is refused, as `fs::write`
/// would.
///
/// `path` should be the real path, with symlinks resolved, so a symlinked
/// file stays a symlink. The temporary file's name is fixed, so two writes to
/// the same file mustn't overlap (AE's saves run one at a time).
pub fn write_atomically(path: &Path, contents: &str) -> io::Result<()> {
    let (Some(dir), Some(name)) = (path.parent(), path.file_name()) else {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Invalid file path",
        ));
    };
    let existing = fs::metadata(path).ok();
    if existing
        .as_ref()
        .is_some_and(|m| m.permissions().readonly())
    {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "The file is read-only",
        ));
    }
    // Not `.md`, so content watchers and Astro's loaders ignore it
    let temp = dir.join(format!(".{}.astro-editor-save", name.to_string_lossy()));
    let mut file = fs::File::create(&temp)?;
    file.write_all(contents.as_bytes())?;
    file.sync_all()?;
    drop(file);
    if let Some(metadata) = existing {
        let _ = fs::set_permissions(&temp, metadata.permissions());
    }
    fs::rename(&temp, path).inspect_err(|_| {
        let _ = fs::remove_file(&temp);
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replaces_the_file_and_leaves_nothing_behind() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("entry.md");
        fs::write(&path, "old").unwrap();
        write_atomically(&path, "new").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn keeps_the_files_permissions() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("entry.md");
        fs::write(&path, "old").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
        write_atomically(&path, "new").unwrap();
        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }

    #[test]
    fn refuses_a_read_only_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("entry.md");
        fs::write(&path, "old").unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();
        assert!(write_atomically(&path, "new").is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "old");
    }

    #[test]
    fn writes_a_new_file() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("new.md");
        write_atomically(&path, "text").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "text");
    }
}
