//! The ESM block of MDX files: the `import`/`export` statements between the
//! frontmatter and the markdown body, which the editor hides and writes back
//! untouched.

mod block;

pub use block::split_esm_block;
