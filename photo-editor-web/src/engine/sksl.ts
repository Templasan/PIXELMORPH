/**
 * The domain's colour shaders are written in SkSL (the app drew them with Skia). WebGL runs
 * GLSL ES 3.0: this turns one into the other, so the shaders keep a single source.
 *
 * `pos` stays what it was under Skia: a point in scene units of the photo's rect
 * (see domain/sceneSize.ts); `uUnits` is that rect's size and `uPx` the target's in pixels.
 */
export function skslToGlsl(sksl: string): string {
  const samplers: string[] = [];
  let body = sksl.replace(/uniform\s+shader\s+(\w+)\s*;/g, (_m, name: string) => {
    samplers.push(name);
    return `uniform sampler2D ${name};`;
  });
  for (const name of samplers) {
    body = body.replace(new RegExp(`\\b${name}\\.eval\\(`, 'g'), `_eval_${name}(`);
  }
  body = body
    .replace(/\bhalf4\b/g, 'vec4')
    .replace(/\bhalf3\b/g, 'vec3')
    .replace(/\bhalf2\b/g, 'vec2')
    .replace(/\bhalf\b/g, 'float')
    .replace(/\bvec4\s+main\s*\(\s*vec2\s+(\w+)\s*\)/, 'vec4 skMain(vec2 $1)');
  // Samplers are declared by the body itself; their eval helpers must follow those declarations.
  const helpers = samplers
    .map((n) => `vec4 _eval_${n}(vec2 p) { return texture(${n}, p / uUnits); }`)
    .join('\n');
  const firstFn = body.search(/\n\s*(float|vec[234]|void|bool)\s+\w+\s*\(/);
  const cut = firstFn < 0 ? body.length : firstFn;
  return `#version 300 es
precision highp float;
uniform vec2 uUnits;
uniform vec2 uPx;
uniform float uFlipOut;
out vec4 fragColor;
${body.slice(0, cut)}
${helpers}
${body.slice(cut)}
void main() {
  vec2 fc = gl_FragCoord.xy;
  if (uFlipOut > 0.5) fc.y = uPx.y - fc.y;
  fragColor = skMain(fc * uUnits / uPx);
}
`;
}
