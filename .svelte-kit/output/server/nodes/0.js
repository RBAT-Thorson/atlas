

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.eGhlyH7U.js","_app/immutable/chunks/CIjbQGh9.js","_app/immutable/chunks/Ar7G6yvD.js","_app/immutable/chunks/Bt2m1wd_.js","_app/immutable/chunks/Cbg4Mhli.js"];
export const stylesheets = [];
export const fonts = [];
