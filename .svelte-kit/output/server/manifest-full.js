export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([".DS_Store","favicon.png","fonts/soehne-buch.otf","fonts/soehne-buch.ttf","fonts/soehne-buch.woff2","svelte.svg","tauri.svg","themes/Atlas.code-workspace","themes/dark.css","themes/global.css","themes/light.css","themes/norge.css","vite.svg"]),
	mimeTypes: {".png":"image/png",".otf":"font/otf",".ttf":"font/ttf",".woff2":"font/woff2",".svg":"image/svg+xml",".css":"text/css"},
	_: {
		client: {start:"_app/immutable/entry/start.DeXnHS9w.js",app:"_app/immutable/entry/app.DNQqsELh.js",imports:["_app/immutable/entry/start.DeXnHS9w.js","_app/immutable/chunks/u63q1SP7.js","_app/immutable/chunks/Ar7G6yvD.js","_app/immutable/chunks/DFGhlYuN.js","_app/immutable/entry/app.DNQqsELh.js","_app/immutable/chunks/Ar7G6yvD.js","_app/immutable/chunks/Dlx30cDz.js","_app/immutable/chunks/CIjbQGh9.js","_app/immutable/chunks/DFGhlYuN.js","_app/immutable/chunks/CY2igKzi.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
