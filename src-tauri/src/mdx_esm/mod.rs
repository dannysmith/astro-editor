//! The ESM block of MDX files: the `import`/`export` statements between the
//! frontmatter and the markdown body, which the editor hides and writes back
//! untouched, except when the component builder adds an import to it.

mod block;
mod edit;
mod imports;
mod plan;

pub use block::split_esm_block;
#[cfg(test)]
pub(crate) use imports::body_esm;
pub use plan::{importable_image, plan_component_import, ImportPlan, PropImports};
