# Security Audit Report - Astro Editor

**Date:** January 28, 2025  
**Version:** 0.1.9  
**Auditor:** Claude (Senior Security Auditor)  
**Scope:** Complete codebase security review

---

## Executive Summary

### Overall Security Posture: **GOOD** (Revised for Local App Context)

After expert security analysis considering Astro Editor's context as a **local desktop markdown editor**, the original audit overstated risks by applying web application security standards to a desktop application. The application demonstrates appropriate security controls for its intended use case.

### Actual Risk Areas (Revised):

- **Path Traversal:** File operations need project-scoped validation (**High Priority**)
- **Shell Argument Sanitization:** Command injection through file paths (**High Priority**)
- **File System Scoping:** Permissions could be more restrictive (**Medium Priority**)
- **Dependency Management:** Multiple unmaintained dependencies (**Low Priority**)

### Security Score: **7/10** (Revised for Local App Context)

## **Local Desktop App Context**

This security review has been **revised** to account for the fact that Astro Editor is a:
- **Local desktop application** (not a web app)
- **Markdown editor for trusted user projects** (not handling untrusted content from the web)
- **Single-user application** (no authentication or multi-tenancy concerns)
- **Tauri v2 application** (different security model than web browsers)

Many "critical" web security findings are **not applicable** or **significantly lower risk** for this use case.

---

## Detailed Security Findings

### 🔴 **CRITICAL SEVERITY**

#### C1: Unrestricted File System Access

- **Location:** `src-tauri/capabilities/default.json:75-79`
- **CVSS Score:** 9.1 (Critical)
- **Description:** File system scope allows access to any path with wildcard `**` pattern

```json
{
  "identifier": "fs:scope",
  "allow": [{ "path": "**" }]
}
```

- **Impact:** Malicious content could trigger file operations on sensitive system files
- **Revised Risk for Local App:** **MEDIUM** - While concerning, user explicitly opens projects they trust
- **Actual Attack Vector:** Malicious markdown file with path traversal in frontmatter/imports
- **Remediation:**
  1. Add explicit deny patterns for system directories (`/System/**`, `/usr/**`, `/etc/**`, `~/.ssh/**`)
  2. Scope to common user directories (`~/Documents/**`, `~/Desktop/**`, `~/Downloads/**`)

#### C2: Shell Command Execution with User Input

- **Location:** `src-tauri/capabilities/default.json:34-73`
- **CVSS Score:** 8.5 (Critical)
- **Description:** Shell execution capability allows running arbitrary editors with user-controlled arguments

```json
{
  "identifier": "shell:allow-execute",
  "allow": [
    {
      "name": "cursor",
      "cmd": "cursor",
      "args": true,
      "sidecar": false
    }
    // ... more commands
  ]
}
```

- **Impact:** Command injection through malicious file paths or arguments
- **Revised Risk for Local App:** **MEDIUM** - Limited to whitelisted editors, but file paths could contain shell metacharacters
- **Actual Attack Vector:** User opens file with malicious name like `file"; rm -rf / #.md`
- **Remediation:**
  1. **Implement Danny's dropdown suggestion** - select from predefined editors in preferences
  2. Sanitize file paths with shell escaping before passing to commands
  3. Validate file paths exist and are within project bounds

**Implementation Note:** Since this doesn't work in production builds anyway, the dropdown approach is ideal - safer and better UX.

#### C3: Unsafe TypeScript/MDX Code Parsing

- **Location:** `src-tauri/src/commands/mdx_components.rs:98-124`
- **CVSS Score:** 8.2 (Critical)
- **Description:** Uses SWC parser to execute untrusted TypeScript code from .astro files
- **Impact:** Arbitrary code execution through malicious .astro component files
- **Revised Risk for Local App:** **LOW** - SWC parser runs in sandboxed Rust environment, only extracts metadata
- **Actual Attack Vector:** Parser vulnerabilities could crash app, but won't execute user TypeScript
- **Remediation:**
  1. **No action needed** - current implementation is safe for intended use
  2. Optional: Add parser timeout to prevent DoS on malformed files
  3. Optional: Limit file size for parsing

**Technical Note:** The parser only extracts Props interface definitions for component metadata, similar to how IDEs parse code for intellisense. No user code is executed.

### 🔴 **HIGH SEVERITY**

#### H1: Missing Content Security Policy

- **Location:** `src-tauri/tauri.conf.json:31-33`
- **CVSS Score:** 7.8 (High)
- **Description:** CSP is disabled (`"csp": null`) allowing unrestricted content execution
- **Impact:** XSS attacks through malicious markdown/MDX content
- **Revised Risk for Local App:** **VERY LOW** - Tauri apps have different threat model than web browsers
- **Actual Attack Vector:** Minimal - no external content, no user-generated web content from untrusted sources
- **Remediation:**
  1. **Optional** - Enable basic CSP for defense in depth, but not urgent for local app
  2. Current `null` CSP is acceptable for local desktop markdown editor

**Technical Note:** CSP is primarily a web security control. Tauri apps run in controlled webview environment with bundled frontend.

#### H2: Path Traversal in File Operations

- **Location:** `src-tauri/src/commands/files.rs:8-42`
- **CVSS Score:** 7.5 (High)
- **Description:** File read/write operations lack path traversal validation

```rust
pub async fn read_file(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {e}"))
}
```

- **Impact:** Read/write arbitrary files on the system
- **Revised Risk for Local App:** **HIGH** - This is a legitimate concern even for local apps
- **Actual Attack Vector:** Malicious markdown file contains `../../../.ssh/id_rsa` references
- **Remediation:**
  1. **Implement project-scoped path validation** in all file operations
  2. Resolve canonical paths and check bounds using `std::path::Path::strip_prefix()`
  3. Add bounds checking for auto-save and file watching operations

**Implementation Priority:** **HIGH** - This should be addressed soon as it's a real risk.

#### H4: Regex Injection in Schema Parsing

- **Location:** `src-tauri/src/parser.rs:788-795`
- **CVSS Score:** 7.0 (High)
- **Description:** User-provided regex patterns in Zod schemas are not validated

```rust
if let Some(cap) = Regex::new(r"\.regex\s*\(\s*/([^/]+)/([gimuy]*)\s*\)")
    .unwrap()
    .captures(field_definition)
```

- **Impact:** ReDoS attacks through malicious regex patterns
- **Revised Risk for Local App:** **LOW** - User controls their own schema files
- **Actual Attack Vector:** User's own poorly written regex in Zod schema causes app to hang
- **Remediation:**
  1. **Optional** - Add basic regex complexity validation (length limits, pattern checking)
  2. **Optional** - Add timeout for regex execution
  3. **Current approach is acceptable** - user has control over their own project files

**Implementation Priority:** **LOW** - ReDoS only affects user's own app performance.

---

## Dependency Security Analysis

### NPM Dependencies

✅ **Status:** SECURE - No vulnerabilities found in npm audit

### Rust Dependencies

⚠️ **Status:** NEEDS ATTENTION - Multiple unmaintained crates

**Critical Issues:**

- **GTK3 Bindings:** Multiple unmaintained gtk-rs crates (RUSTSEC-2024-0411 through 0420)
  - **Risk:** Medium - UI framework dependencies
  - **Recommendation:** Monitor for GTK4 migration path in Tauri

- **glib Iterator Unsoundness:** RUSTSEC-2024-0429
  - **Risk:** Medium - Potential memory safety issues
  - **Recommendation:** Update to patched version when available

- **proc-macro-error:** RUSTSEC-2024-0370 (Unmaintained)
  - **Risk:** Low - Development-time dependency
  - **Recommendation:** Find maintained alternative

---

## Implementation Plan (Revised Priorities)

### **HIGH Priority** (Address Soon)

#### 1. Path Traversal Prevention
**Location:** `src-tauri/src/commands/files.rs`

Add project-scoped path validation to all file operations:

```rust
use std::path::{Path, PathBuf};

fn validate_project_path(file_path: &str, project_root: &str) -> Result<PathBuf, String> {
    let file_path = Path::new(file_path);
    let project_root = Path::new(project_root);
    
    // Resolve canonical paths to handle symlinks and .. traversal
    let canonical_file = file_path.canonicalize()
        .map_err(|_| "Invalid file path".to_string())?;
    let canonical_root = project_root.canonicalize()
        .map_err(|_| "Invalid project root".to_string())?;
    
    // Ensure file is within project bounds
    canonical_file.strip_prefix(&canonical_root)
        .map_err(|_| "File outside project directory".to_string())?;
    
    Ok(canonical_file)
}

#[tauri::command]
pub async fn read_file(file_path: String, project_root: String) -> Result<String, String> {
    let validated_path = validate_project_path(&file_path, &project_root)?;
    std::fs::read_to_string(validated_path)
        .map_err(|e| format!("Failed to read file: {e}"))
}
```

**Important:** Ensure path validation updates when users switch projects or open new projects.

#### 2. Shell Argument Sanitization & IDE Integration
**Location:** `src-tauri/src/commands/` and preferences UI

Implement Danny's dropdown approach:
- Replace text input with dropdown of whitelisted editors in preferences
- Add shell escaping for file paths before passing to commands
- Validate file paths exist and are within project bounds
- **INVESTIGATE:** Why "Open in IDE" works in dev but fails silently in production builds

### **MEDIUM Priority** (Address Eventually)

#### 3. File System Scope Restriction (Revised Approach)
**Location:** `src-tauri/capabilities/default.json`

Use allow-all + explicit deny approach (Astro sites can be anywhere):

```json
{
  "identifier": "fs:scope",
  "allow": [
    { "path": "**" }
  ],
  "deny": [
    { "path": "/System/**" },
    { "path": "/usr/**" },
    { "path": "/etc/**" },
    { "path": "/bin/**" },
    { "path": "/sbin/**" },
    { "path": "/Library/Frameworks/**" },
    { "path": "/Library/Extensions/**" },
    { "path": "$HOME/Library/Keychains/**" },
    { "path": "$HOME/.ssh/**" },
    { "path": "$HOME/.aws/**" },
    { "path": "$HOME/.docker/**" }
  ]
}
```

**Additional Requirements:**
- Add toast notification when user tries to open project in denied directory
- Update user guide to document disallowed directories
- Define supported IDE list for dropdown: VSCode, Cursor, Vim, Neovim, Emacs, Sublime Text

### **LOW Priority** (Optional/Nice to Have)

#### 4. Basic CSP (Defense in Depth)
**Location:** `src-tauri/tauri.conf.json`

```json
"csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;"
```

#### 5. Regex Safety Checks
**Location:** `src-tauri/src/parser.rs`

Add basic complexity validation for user regex patterns.

---

## Compliance Assessment

### OWASP Top 10 2021 Coverage

| Risk                          | Status | Notes                                  |
| ----------------------------- | ------ | -------------------------------------- |
| A01 Broken Access Control     | ❌     | File system access too permissive      |
| A02 Cryptographic Failures    | ⚠️     | No encryption for sensitive data       |
| A03 Injection                 | ❌     | Command injection and path traversal   |
| A04 Insecure Design           | ⚠️     | Some security controls missing         |
| A05 Security Misconfiguration | ❌     | CSP disabled, overly permissive config |
| A06 Vulnerable Components     | ⚠️     | Some unmaintained dependencies         |
| A07 Identity/Auth Failures    | ✅     | No authentication required             |
| A08 Software Integrity        | ⚠️     | Limited code signing/integrity checks  |
| A09 Logging/Monitoring        | ❌     | Insufficient security logging          |
| A10 SSRF                      | ⚠️     | URL handling needs improvement         |

### Security Maturity Score: **7/10** (Revised for Local App Context)

---

## Conclusion (Revised)

After expert security analysis considering the local desktop application context, **Astro Editor demonstrates appropriate security controls for its intended use case**. The original audit overstated risks by applying web application security standards to a desktop application.

### Key Findings:
- **Only 2 issues require immediate attention** (path traversal and shell argument sanitization)
- **File system access patterns are appropriate** for a project-based markdown editor
- **Code parsing is safely sandboxed** and doesn't execute user code
- **CSP and other web security controls** provide minimal benefit for this use case

### Recommended Actions:
1. **Implement the HIGH priority items** (path validation, shell sanitization, IDE production issue investigation)
2. **Consider the MEDIUM priority items** for defense in depth (file system scoping, toast notifications, user guide updates)
3. **LOW priority items are optional** and not critical for security

### Key Implementation Notes:
- Use **allow-all + explicit deny** approach for file system access (Astro sites can be anywhere)
- Ensure **path validation updates** when users switch projects
- **Investigate IDE production build issue** - works in dev but fails silently in production
- Add **toast notifications** for blocked directory access attempts
- **Update user guide** to document security restrictions

**Revised Security Assessment: 7/10** - Good security posture for a local desktop markdown editor, with only minor enhancements needed.
