import { Definitions } from "./file-tree-processor.js";
//#region src/user-components/file-tree-icons.d.ts
/**
 * Based on https://github.com/elviswolcott/seti-icons which
 * is derived from https://github.com/jesseweed/seti-ui/
 *
 * Copyright (c) 2014 Jesse Weed
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
declare const definitions: Definitions;
declare const FileIcons: {
  'seti:folder': string;
  'seti:bsl': string;
  'seti:mdo': string;
  'seti:salesforce': string;
  'seti:asm': string;
  'seti:bicep': string;
  'seti:bazel': string;
  'seti:c': string;
  'seti:c-sharp': string;
  'seti:html': string;
  'seti:cpp': string;
  'seti:clojure': string;
  'seti:coldfusion': string;
  'seti:coffee': string;
  'seti:config': string;
  'seti:crystal': string;
  'seti:crystal_embedded': string;
  'seti:json': string;
  'seti:css': string;
  'seti:csv': string;
  'seti:xls': string;
  'seti:cu': string;
  'seti:cake': string;
  'seti:cake_php': string;
  'seti:d': string;
  'seti:word': string;
  'seti:elixir': string;
  'seti:elixir_script': string;
  'seti:hex': string;
  'seti:elm': string;
  'seti:favicon': string;
  'seti:f-sharp': string;
  'seti:git': string;
  'seti:go': string;
  'seti:godot': string;
  'seti:gradle': string;
  'seti:grails': string;
  'seti:graphql': string;
  'seti:hacklang': string;
  'seti:haml': string;
  'seti:mustache': string;
  'seti:haskell': string;
  'seti:haxe': string;
  'seti:jade': string;
  'seti:java': string;
  'seti:javascript': string;
  'seti:jinja': string;
  'seti:julia': string;
  'seti:karma': string;
  'seti:kotlin': string;
  'seti:dart': string;
  'seti:liquid': string;
  'seti:livescript': string;
  'seti:lua': string;
  'seti:markdown': string;
  'seti:argdown': string;
  'seti:info': string;
  'seti:clock': string;
  'seti:maven': string;
  'seti:nim': string;
  'seti:github': string;
  'seti:notebook': string;
  'seti:nunjucks': string;
  'seti:npm': string;
  'seti:ocaml': string;
  'seti:odata': string;
  'seti:perl': string;
  'seti:php': string;
  'seti:pipeline': string;
  'seti:pddl': string;
  'seti:plan': string;
  'seti:happenings': string;
  'seti:powershell': string;
  'seti:prisma': string;
  'seti:pug': string;
  'seti:puppet': string;
  'seti:purescript': string;
  'seti:python': string;
  'seti:react': string;
  'seti:rescript': string;
  'seti:R': string;
  'seti:ruby': string;
  'seti:rust': string;
  'seti:sass': string;
  'seti:spring': string;
  'seti:slim': string;
  'seti:smarty': string;
  'seti:sbt': string;
  'seti:scala': string;
  'seti:ethereum': string;
  'seti:stylus': string;
  'seti:svelte': string;
  'seti:swift': string;
  'seti:db': string;
  'seti:terraform': string;
  'seti:tex': string;
  'seti:default': string;
  'seti:twig': string;
  'seti:typescript': string;
  'seti:tsconfig': string;
  'seti:vala': string;
  'seti:vite': string;
  'seti:vue': string;
  'seti:wasm': string;
  'seti:wat': string;
  'seti:xml': string;
  'seti:yml': string;
  'seti:prolog': string;
  'seti:zig': string;
  'seti:zip': string;
  'seti:wgt': string;
  'seti:illustrator': string;
  'seti:photoshop': string;
  'seti:pdf': string;
  'seti:font': string;
  'seti:image': string;
  'seti:svg': string;
  'seti:sublime': string;
  'seti:code-search': string;
  'seti:shell': string;
  'seti:video': string;
  'seti:audio': string;
  'seti:windows': string;
  'seti:jenkins': string;
  'seti:babel': string;
  'seti:bower': string;
  'seti:docker': string;
  'seti:code-climate': string;
  'seti:eslint': string;
  'seti:firebase': string;
  'seti:firefox': string;
  'seti:gitlab': string;
  'seti:grunt': string;
  'seti:gulp': string;
  'seti:ionic': string;
  'seti:platformio': string;
  'seti:rollup': string;
  'seti:stylelint': string;
  'seti:yarn': string;
  'seti:webpack': string;
  'seti:lock': string;
  'seti:license': string;
  'seti:makefile': string;
  'seti:heroku': string;
  'seti:todo': string;
  'seti:ignored': string;
};
type FileIcon = 'seti:folder' | 'seti:bsl' | 'seti:mdo' | 'seti:salesforce' | 'seti:asm' | 'seti:bicep' | 'seti:bazel' | 'seti:c' | 'seti:c-sharp' | 'seti:html' | 'seti:cpp' | 'seti:clojure' | 'seti:coldfusion' | 'seti:coffee' | 'seti:config' | 'seti:crystal' | 'seti:crystal_embedded' | 'seti:json' | 'seti:css' | 'seti:csv' | 'seti:xls' | 'seti:cu' | 'seti:cake' | 'seti:cake_php' | 'seti:d' | 'seti:word' | 'seti:elixir' | 'seti:elixir_script' | 'seti:hex' | 'seti:elm' | 'seti:favicon' | 'seti:f-sharp' | 'seti:git' | 'seti:go' | 'seti:godot' | 'seti:gradle' | 'seti:grails' | 'seti:graphql' | 'seti:hacklang' | 'seti:haml' | 'seti:mustache' | 'seti:haskell' | 'seti:haxe' | 'seti:jade' | 'seti:java' | 'seti:javascript' | 'seti:jinja' | 'seti:julia' | 'seti:karma' | 'seti:kotlin' | 'seti:dart' | 'seti:liquid' | 'seti:livescript' | 'seti:lua' | 'seti:markdown' | 'seti:argdown' | 'seti:info' | 'seti:clock' | 'seti:maven' | 'seti:nim' | 'seti:github' | 'seti:notebook' | 'seti:nunjucks' | 'seti:npm' | 'seti:ocaml' | 'seti:odata' | 'seti:perl' | 'seti:php' | 'seti:pipeline' | 'seti:pddl' | 'seti:plan' | 'seti:happenings' | 'seti:powershell' | 'seti:prisma' | 'seti:pug' | 'seti:puppet' | 'seti:purescript' | 'seti:python' | 'seti:react' | 'seti:rescript' | 'seti:R' | 'seti:ruby' | 'seti:rust' | 'seti:sass' | 'seti:spring' | 'seti:slim' | 'seti:smarty' | 'seti:sbt' | 'seti:scala' | 'seti:ethereum' | 'seti:stylus' | 'seti:svelte' | 'seti:swift' | 'seti:db' | 'seti:terraform' | 'seti:tex' | 'seti:default' | 'seti:twig' | 'seti:typescript' | 'seti:tsconfig' | 'seti:vala' | 'seti:vite' | 'seti:vue' | 'seti:wasm' | 'seti:wat' | 'seti:xml' | 'seti:yml' | 'seti:prolog' | 'seti:zig' | 'seti:zip' | 'seti:wgt' | 'seti:illustrator' | 'seti:photoshop' | 'seti:pdf' | 'seti:font' | 'seti:image' | 'seti:svg' | 'seti:sublime' | 'seti:code-search' | 'seti:shell' | 'seti:video' | 'seti:audio' | 'seti:windows' | 'seti:jenkins' | 'seti:babel' | 'seti:bower' | 'seti:docker' | 'seti:code-climate' | 'seti:eslint' | 'seti:firebase' | 'seti:firefox' | 'seti:gitlab' | 'seti:grunt' | 'seti:gulp' | 'seti:ionic' | 'seti:platformio' | 'seti:rollup' | 'seti:stylelint' | 'seti:yarn' | 'seti:webpack' | 'seti:lock' | 'seti:license' | 'seti:makefile' | 'seti:heroku' | 'seti:todo' | 'seti:ignored';
//#endregion
export { FileIcon, FileIcons, definitions };