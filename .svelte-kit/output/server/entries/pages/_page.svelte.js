import { w as sanitize_props, x as rest_props, y as attributes, z as clsx, F as ensure_array_like, G as element, v as slot, J as bind_props, K as spread_props, N as attr, O as attr_class, P as attr_style, Q as stringify } from "../../chunks/index.js";
import { l as ssr_context, m as fallback, k as escape_html } from "../../chunks/context.js";
import { invoke } from "@tauri-apps/api/core";
import "@tauri-apps/api/path";
import { Store } from "@tauri-apps/plugin-store";
import "@tauri-apps/api/event";
import "@tauri-apps/api/window";
import "@tauri-apps/api/dpi";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
async function tick() {
}
function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var FEATURE_FLAG_NAMES = Object.freeze({
  // This flag exists as a workaround for issue 454 (basically a browser bug) - seems like these rect values take time to update when in grid layout. Setting it to true can cause strange behaviour in the REPL for non-grid zones, see issue 470
  USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT: "USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT"
});
_defineProperty({}, FEATURE_FLAG_NAMES.USE_COMPUTED_STYLE_INSTEAD_OF_BOUNDING_RECT, false);
var _ID_TO_INSTRUCTION;
var INSTRUCTION_IDs$1 = {
  DND_ZONE_ACTIVE: "dnd-zone-active",
  DND_ZONE_DRAG_DISABLED: "dnd-zone-drag-disabled"
};
_ID_TO_INSTRUCTION = {}, _defineProperty(_ID_TO_INSTRUCTION, INSTRUCTION_IDs$1.DND_ZONE_ACTIVE, "Tab to one the items and press space-bar or enter to start dragging it"), _defineProperty(_ID_TO_INSTRUCTION, INSTRUCTION_IDs$1.DND_ZONE_DRAG_DISABLED, "This is a disabled drag and drop list"), _ID_TO_INSTRUCTION;
let store = null;
const AIRTABLE_BASE_ID = "appL7Lq4VPcHgAewL";
const AIRTABLE_APPS_TABLE_ID = "tblr8L369WEh7mGYh";
const AIRTABLE_API_KEY = "patAbSQCuNbPKVIwG.bb8ad8d617b8b32017c7cc5482f021dbcd1efa3598ae05b71cee7aba651f49a7";
function getAirtableApiKey() {
  return AIRTABLE_API_KEY;
}
const FIELD_IDS = {
  Name: "fldN41qoRuE3Jbe6D",
  Type: "fldQ4oETBTtcC5qVe",
  Target: "fld0YbsNSWDiMaO0h",
  Enabled: "fld1Bv8ukgCQLvNJb",
  Icon: "fldfF4CSMX5GwlYnL",
  // Attachment field - requires public URLs
  IconB64: "fld9NOg5wFtWv4xtS",
  // Long Text field for base64 storage
  Ownership: "fldO6ZWEuutLhTxQU",
  Owner: "fldhgCgBVIoWNCjZB",
  Parent: "fldaEnNJPAD99piXc"
};
const OWNERSHIP_IDS = {
  Global: "selZiQSSE5YAvQGXT",
  Public: "selKiYgxvMTN7ULqO",
  Private: "selYEJUoktPMFM87d"
};
const TYPE_IDS = {
  web: "selNX7ivtZ5EOV1Cw",
  "win app": "selbHeBqGFoXupRwS",
  "mac app": "selicwcchercMg0rA",
  chrome: "selZ9HCVtmMpZt7k8"
};
async function getStore() {
  if (!store) {
    console.log("🧠 Loading store...");
    store = await Store.load("settings.json");
    console.log("✅ Store loaded.");
  }
  return store;
}
async function loadCustomApps() {
  const s = await getStore();
  const customApps = await s.get("custom-apps");
  console.log("📥 Loaded custom apps from disk:", customApps);
  if (!customApps || !Array.isArray(customApps)) {
    return [];
  }
  return customApps;
}
async function loadAllIconData() {
  const s = await getStore();
  const iconData = await s.get("icon-data") || {};
  return iconData;
}
async function updateAirtableApp(recordId, updates) {
  console.log("📤 Updating app in Airtable:", recordId);
  const fields = {};
  if (updates.Name !== void 0) {
    fields[FIELD_IDS.Name] = updates.Name;
  }
  if (updates.Type !== void 0) {
    fields[FIELD_IDS.Type] = TYPE_IDS[updates.Type] || TYPE_IDS["mac app"];
  }
  if (updates.Target !== void 0) {
    fields[FIELD_IDS.Target] = updates.Target;
  }
  if (updates.Enabled !== void 0) {
    fields[FIELD_IDS.Enabled] = updates.Enabled;
  }
  if (updates.Ownership !== void 0) {
    fields[FIELD_IDS.Ownership] = OWNERSHIP_IDS[updates.Ownership] || OWNERSHIP_IDS.Private;
  }
  if (updates.Owner !== void 0) {
    fields[FIELD_IDS.Owner] = updates.Owner;
  }
  if (updates.Icon !== void 0) {
    fields[FIELD_IDS.Icon] = [{
      url: updates.Icon
    }];
  }
  if (updates.IconB64 !== void 0) {
    fields[FIELD_IDS.IconB64] = updates.IconB64;
  }
  if (updates.Parent !== void 0) {
    fields[FIELD_IDS.Parent] = updates.Parent;
  }
  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_APPS_TABLE_ID}/${recordId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fields })
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Airtable update failed:", errorData);
      throw new Error(`Failed to update app in Airtable: ${response.statusText}`);
    }
    const data = await response.json();
    console.log("✅ App updated in Airtable:", data);
    return data;
  } catch (error) {
    console.error("❌ Error updating app in Airtable:", error);
    throw error;
  }
}
async function saveAppOrder(userId, appOrder) {
  console.log("💾 Saving app order for user:", userId, "order:", appOrder);
  try {
    const appOrderJson = JSON.stringify(appOrder);
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblbpYp0Cza2JMKKR/${userId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: {
            AppOrder: appOrderJson
          }
        })
      }
    );
    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Failed to save app order:", errorData);
      throw new Error(`Failed to save app order: ${response.statusText}`);
    }
    console.log("✅ App order saved successfully");
  } catch (error) {
    console.error("❌ Error saving app order:", error);
    throw error;
  }
}
/**
 * @license lucide-svelte v0.553.0 - ISC
 *
 * ISC License
 * 
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
 * 
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 * 
 * ---
 * 
 * The MIT License (MIT) (for portions derived from Feather)
 * 
 * Copyright (c) 2013-2023 Cole Bemis
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */
const defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
};
function Icon($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  const $$restProps = rest_props($$sanitized_props, [
    "name",
    "color",
    "size",
    "strokeWidth",
    "absoluteStrokeWidth",
    "iconNode"
  ]);
  $$renderer.component(($$renderer2) => {
    let name = fallback($$props["name"], void 0);
    let color = fallback($$props["color"], "currentColor");
    let size = fallback($$props["size"], 24);
    let strokeWidth = fallback($$props["strokeWidth"], 2);
    let absoluteStrokeWidth = fallback($$props["absoluteStrokeWidth"], false);
    let iconNode = fallback($$props["iconNode"], () => [], true);
    const mergeClasses = (...classes) => classes.filter((className, index, array) => {
      return Boolean(className) && array.indexOf(className) === index;
    }).join(" ");
    $$renderer2.push(`<svg${attributes(
      {
        ...defaultAttributes,
        ...$$restProps,
        width: size,
        height: size,
        stroke: color,
        "stroke-width": absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
        class: clsx(mergeClasses("lucide-icon", "lucide", name ? `lucide-${name}` : "", $$sanitized_props.class))
      },
      void 0,
      void 0,
      void 0,
      3
    )}><!--[-->`);
    const each_array = ensure_array_like(iconNode);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let [tag, attrs] = each_array[$$index];
      element($$renderer2, tag, () => {
        $$renderer2.push(`${attributes({ ...attrs }, void 0, void 0, void 0, 3)}`);
      });
    }
    $$renderer2.push(`<!--]--><!--[-->`);
    slot($$renderer2, $$props, "default", {});
    $$renderer2.push(`<!--]--></svg>`);
    bind_props($$props, {
      name,
      color,
      size,
      strokeWidth,
      absoluteStrokeWidth,
      iconNode
    });
  });
}
function Chevron_down($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
   * @license lucide-svelte v0.553.0 - ISC
   *
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * ---
   *
   * The MIT License (MIT) (for portions derived from Feather)
   *
   * Copyright (c) 2013-2023 Cole Bemis
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   *
   */
  const iconNode = [["path", { "d": "m6 9 6 6 6-6" }]];
  Icon($$renderer, spread_props([
    { name: "chevron-down" },
    $$sanitized_props,
    {
      /**
       * @component @name ChevronDown
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJtNiA5IDYgNiA2LTYiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/chevron-down
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Folder_open($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
   * @license lucide-svelte v0.553.0 - ISC
   *
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * ---
   *
   * The MIT License (MIT) (for portions derived from Feather)
   *
   * Copyright (c) 2013-2023 Cole Bemis
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   *
   */
  const iconNode = [
    [
      "path",
      {
        "d": "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"
      }
    ]
  ];
  Icon($$renderer, spread_props([
    { name: "folder-open" },
    $$sanitized_props,
    {
      /**
       * @component @name FolderOpen
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJtNiAxNCAxLjUtMi45QTIgMiAwIDAgMSA5LjI0IDEwSDIwYTIgMiAwIDAgMSAxLjk0IDIuNWwtMS41NCA2YTIgMiAwIDAgMS0xLjk1IDEuNUg0YTIgMiAwIDAgMS0yLTJWNWEyIDIgMCAwIDEgMi0yaDMuOWEyIDIgMCAwIDEgMS42OS45bC44MSAxLjJhMiAyIDAgMCAwIDEuNjcuOUgxOGEyIDIgMCAwIDEgMiAydjIiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/folder-open
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Folder_plus($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
   * @license lucide-svelte v0.553.0 - ISC
   *
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * ---
   *
   * The MIT License (MIT) (for portions derived from Feather)
   *
   * Copyright (c) 2013-2023 Cole Bemis
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   *
   */
  const iconNode = [
    ["path", { "d": "M12 10v6" }],
    ["path", { "d": "M9 13h6" }],
    [
      "path",
      {
        "d": "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
      }
    ]
  ];
  Icon($$renderer, spread_props([
    { name: "folder-plus" },
    $$sanitized_props,
    {
      /**
       * @component @name FolderPlus
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTIgMTB2NiIgLz4KICA8cGF0aCBkPSJNOSAxM2g2IiAvPgogIDxwYXRoIGQ9Ik0yMCAyMGEyIDIgMCAwIDAgMi0yVjhhMiAyIDAgMCAwLTItMmgtNy45YTIgMiAwIDAgMS0xLjY5LS45TDkuNiAzLjlBMiAyIDAgMCAwIDcuOTMgM0g0YTIgMiAwIDAgMC0yIDJ2MTNhMiAyIDAgMCAwIDIgMloiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/folder-plus
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Plus($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
   * @license lucide-svelte v0.553.0 - ISC
   *
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * ---
   *
   * The MIT License (MIT) (for portions derived from Feather)
   *
   * Copyright (c) 2013-2023 Cole Bemis
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   *
   */
  const iconNode = [["path", { "d": "M5 12h14" }], ["path", { "d": "M12 5v14" }]];
  Icon($$renderer, spread_props([
    { name: "plus" },
    $$sanitized_props,
    {
      /**
       * @component @name Plus
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNNSAxMmgxNCIgLz4KICA8cGF0aCBkPSJNMTIgNXYxNCIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/plus
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Rotate_cw($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
   * @license lucide-svelte v0.553.0 - ISC
   *
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * ---
   *
   * The MIT License (MIT) (for portions derived from Feather)
   *
   * Copyright (c) 2013-2023 Cole Bemis
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   *
   */
  const iconNode = [
    [
      "path",
      { "d": "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" }
    ],
    ["path", { "d": "M21 3v5h-5" }]
  ];
  Icon($$renderer, spread_props([
    { name: "rotate-cw" },
    $$sanitized_props,
    {
      /**
       * @component @name RotateCw
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMjEgMTJhOSA5IDAgMSAxLTktOWMyLjUyIDAgNC45MyAxIDYuNzQgMi43NEwyMSA4IiAvPgogIDxwYXRoIGQ9Ik0yMSAzdjVoLTUiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/rotate-cw
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Search($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
   * @license lucide-svelte v0.553.0 - ISC
   *
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * ---
   *
   * The MIT License (MIT) (for portions derived from Feather)
   *
   * Copyright (c) 2013-2023 Cole Bemis
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   *
   */
  const iconNode = [
    ["path", { "d": "m21 21-4.34-4.34" }],
    ["circle", { "cx": "11", "cy": "11", "r": "8" }]
  ];
  Icon($$renderer, spread_props([
    { name: "search" },
    $$sanitized_props,
    {
      /**
       * @component @name Search
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJtMjEgMjEtNC4zNC00LjM0IiAvPgogIDxjaXJjbGUgY3g9IjExIiBjeT0iMTEiIHI9IjgiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/search
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Settings($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
   * @license lucide-svelte v0.553.0 - ISC
   *
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * ---
   *
   * The MIT License (MIT) (for portions derived from Feather)
   *
   * Copyright (c) 2013-2023 Cole Bemis
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   *
   */
  const iconNode = [
    [
      "path",
      {
        "d": "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
      }
    ],
    ["circle", { "cx": "12", "cy": "12", "r": "3" }]
  ];
  Icon($$renderer, spread_props([
    { name: "settings" },
    $$sanitized_props,
    {
      /**
       * @component @name Settings
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNOS42NzEgNC4xMzZhMi4zNCAyLjM0IDAgMCAxIDQuNjU5IDAgMi4zNCAyLjM0IDAgMCAwIDMuMzE5IDEuOTE1IDIuMzQgMi4zNCAwIDAgMSAyLjMzIDQuMDMzIDIuMzQgMi4zNCAwIDAgMCAwIDMuODMxIDIuMzQgMi4zNCAwIDAgMS0yLjMzIDQuMDMzIDIuMzQgMi4zNCAwIDAgMC0zLjMxOSAxLjkxNSAyLjM0IDIuMzQgMCAwIDEtNC42NTkgMCAyLjM0IDIuMzQgMCAwIDAtMy4zMi0xLjkxNSAyLjM0IDIuMzQgMCAwIDEtMi4zMy00LjAzMyAyLjM0IDIuMzQgMCAwIDAgMC0zLjgzMUEyLjM0IDIuMzQgMCAwIDEgNi4zNSA2LjA1MWEyLjM0IDIuMzQgMCAwIDAgMy4zMTktMS45MTUiIC8+CiAgPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMyIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/settings
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function X($$renderer, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
   * @license lucide-svelte v0.553.0 - ISC
   *
   * ISC License
   *
   * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.
   *
   * Permission to use, copy, modify, and/or distribute this software for any
   * purpose with or without fee is hereby granted, provided that the above
   * copyright notice and this permission notice appear in all copies.
   *
   * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
   * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
   * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
   * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
   * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
   * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
   * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * ---
   *
   * The MIT License (MIT) (for portions derived from Feather)
   *
   * Copyright (c) 2013-2023 Cole Bemis
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   *
   */
  const iconNode = [
    ["path", { "d": "M18 6 6 18" }],
    ["path", { "d": "m6 6 12 12" }]
  ];
  Icon($$renderer, spread_props([
    { name: "x" },
    $$sanitized_props,
    {
      /**
       * @component @name X
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTggNiA2IDE4IiAvPgogIDxwYXRoIGQ9Im02IDYgMTIgMTIiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/x
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$renderer2) => {
        $$renderer2.push(`<!--[-->`);
        slot($$renderer2, $$props, "default", {});
        $$renderer2.push(`<!--]-->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let combinedChildHoverCandidateId, combinedChildReadyParentId;
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };
    const AIRTABLE_API_KEY2 = getAirtableApiKey();
    console.log = (...args) => {
      originalConsole.log(...args);
      const message = args.map((arg) => typeof arg === "object" ? JSON.stringify(arg) : String(arg)).join(" ");
      invoke("write_console_log", { level: "LOG", message }).catch(() => {
      });
    };
    console.error = (...args) => {
      originalConsole.error(...args);
      const message = args.map((arg) => typeof arg === "object" ? JSON.stringify(arg) : String(arg)).join(" ");
      invoke("write_console_log", { level: "ERROR", message }).catch(() => {
      });
    };
    console.warn = (...args) => {
      originalConsole.warn(...args);
      const message = args.map((arg) => typeof arg === "object" ? JSON.stringify(arg) : String(arg)).join(" ");
      invoke("write_console_log", { level: "WARN", message }).catch(() => {
      });
    };
    console.info = (...args) => {
      originalConsole.info(...args);
      const message = args.map((arg) => typeof arg === "object" ? JSON.stringify(arg) : String(arg)).join(" ");
      invoke("write_console_log", { level: "INFO", message }).catch(() => {
      });
    };
    let apps = [];
    let loading = false;
    let error = null;
    let dragActive = false;
    let externalFileDragActive = false;
    let successMessage = null;
    let iconCache = /* @__PURE__ */ new Map();
    let selectedUserId = null;
    let selectedUser = null;
    let searchQuery = "";
    let filteredApps = [];
    let appOrder = [];
    let iconSize = 256;
    let iconPadding = 16;
    let gridColumns = 4;
    let textSize = 18;
    let marginMin = 24;
    let appIconRadius = 16;
    let expandedAppId = null;
    let expandedChildApps = [];
    let expandedParentApp = null;
    let childMenuPosition = null;
    const CHILD_MENU_WIDTH_ESTIMATE = 260;
    const CHILD_MENU_GAP = 16;
    const CHILD_MENU_MARGIN = 12;
    let dragHoverCandidateId = null;
    let dragChildParentId = null;
    let lastExternalDropKey = null;
    let lastExternalDropSource = null;
    let lastExternalDropTimestamp = 0;
    let reorderHoldCandidateId = null;
    let reorderChildReadyId = null;
    let childMenuDragChildId = null;
    let childMenuDragParentId = null;
    const EXTERNAL_DROP_DUPLICATE_WINDOW = 1500;
    const CHILD_DETACH_MIME = "application/atlas-child-detach";
    let windowWidth = 0;
    let effectiveIconSize = iconSize;
    let effectiveTextSize = textSize;
    let iconZoomFactors = {};
    let filteredBrowserApps = [];
    let searchActive = false;
    function closeChildMenu() {
      expandedAppId = null;
      expandedChildApps = [];
      childMenuPosition = null;
      childMenuDragChildId = null;
      childMenuDragParentId = null;
    }
    async function positionChildMenu(anchorEl) {
      if (!expandedAppId) {
        childMenuPosition = null;
        return;
      }
      if (!anchorEl) {
        anchorEl = document.querySelector(`[data-app-button="${expandedAppId}"]`);
      }
      if (!anchorEl) {
        closeChildMenu();
        return;
      }
      const rect = anchorEl.getBoundingClientRect();
      const computePosition = (menuWidth, menuHeight) => {
        let side = rect.right + CHILD_MENU_GAP + menuWidth <= window.innerWidth ? "right" : "left";
        let left = side === "right" ? rect.right + CHILD_MENU_GAP : rect.left - CHILD_MENU_GAP - menuWidth;
        if (left < CHILD_MENU_MARGIN) {
          left = CHILD_MENU_MARGIN;
          side = "right";
        }
        if (left + menuWidth > window.innerWidth - CHILD_MENU_MARGIN) {
          left = Math.max(CHILD_MENU_MARGIN, window.innerWidth - CHILD_MENU_MARGIN - menuWidth);
        }
        let top = rect.top + rect.height / 2 - menuHeight / 2;
        top = Math.max(CHILD_MENU_MARGIN, Math.min(top, window.innerHeight - CHILD_MENU_MARGIN - menuHeight));
        return { top, left, side };
      };
      childMenuPosition = computePosition(CHILD_MENU_WIDTH_ESTIMATE, rect.height);
      await tick();
    }
    function resetChildDropState() {
      dragHoverCandidateId = null;
      dragChildParentId = null;
    }
    function makeDropKey(paths) {
      return paths.map((path) => path.toLowerCase()).sort().join("|");
    }
    function shouldSkipDuplicateDrop(source, dropKey) {
      return !!lastExternalDropKey && lastExternalDropKey === dropKey && lastExternalDropSource !== null && lastExternalDropSource !== source && Date.now() - lastExternalDropTimestamp < EXTERNAL_DROP_DUPLICATE_WINDOW;
    }
    function recordDropHandled(source, dropKey) {
      lastExternalDropKey = dropKey;
      lastExternalDropSource = source;
      lastExternalDropTimestamp = Date.now();
    }
    function userOwnsApp(app) {
      {
        return false;
      }
    }
    function resetReorderChildState() {
      reorderHoldCandidateId = null;
      reorderChildReadyId = null;
    }
    function endReorderDragSession() {
      resetReorderChildState();
    }
    function isExternalFileDrag(event) {
      if (event?.dataTransfer?.types) {
        return Array.from(event.dataTransfer.types).includes("Files");
      }
      return externalFileDragActive;
    }
    function endChildMenuDrag() {
      childMenuDragChildId = null;
      childMenuDragParentId = null;
    }
    async function refreshApps() {
      loading = true;
      error = null;
      closeChildMenu();
      try {
        const result = await invoke("refresh_apps", { apiKey: AIRTABLE_API_KEY2 });
        let airtableApps = Array.isArray(result) ? result.filter((r) => r.Enabled) : [];
        if (selectedUserId) ;
        else {
          airtableApps = airtableApps.filter((app) => {
            const ownership = app.ownership;
            return ownership === "Global";
          });
        }
        const allIconData = await loadAllIconData();
        console.log("📦 Loaded icon data from local storage:", Object.keys(allIconData).length, "icons");
        for (const app of airtableApps) {
          let iconSource = "";
          if (!app.Icon) {
            app.Icon = [];
          }
          if (!app.Icon[0]) {
            app.Icon[0] = {};
          }
          if (app.IconB64 && app.IconB64.length > 0) {
            app.Icon[0].iconDataUrl = app.IconB64;
            iconSource = "Airtable IconB64 field";
          } else if (app.Target && allIconData[app.Target]) {
            app.Icon[0].iconDataUrl = allIconData[app.Target];
            iconSource = "local cache";
          }
          if (iconSource) {
            console.log("🎨 Attaching icon to:", app.Name, "from", iconSource);
          }
        }
        const customApps = await loadCustomApps();
        console.log("📂 Loaded custom apps from storage:", customApps);
        for (const app of customApps) {
          console.log("🔍 Processing custom app:", app.Name, "Icon:", app.Icon);
          if (app.Icon && app.Icon[0] && app.Icon[0].path && !app.Icon[0].iconDataUrl) {
            try {
              console.log("⏳ Loading icon data URL for:", app.Name);
              const iconDataUrl = await loadIconDataUrl(app.Icon[0].path);
              if (iconDataUrl) {
                app.Icon[0].iconDataUrl = iconDataUrl;
                console.log("✅ Icon data URL set for:", app.Name);
              }
            } catch (e) {
              console.warn("Could not load icon data URL for stored app:", e);
            }
          } else {
            console.log("⏭️ Skipping icon load:", app.Name, "- path:", app.Icon[0]?.path, "- iconDataUrl:", app.Icon[0]?.iconDataUrl);
          }
        }
        const allApps = [...airtableApps, ...customApps];
        for (const app of allApps) {
          if (app.Parent && Array.isArray(app.Parent) && app.Parent.length > 0) {
            const parentId = app.Parent[0];
            const parentApp = allApps.find((a) => a.id === parentId);
            if (parentApp) {
              console.log(`👨‍👧 Applying inheritance from ${parentApp.Name} to ${app.Name}`);
              app.ownership = parentApp.ownership;
              app.owner = parentApp.owner;
              app.HideFrom = parentApp.HideFrom;
              app.PublicUsers = parentApp.PublicUsers;
              console.log(`   ✅ Inherited: ownership=${app.ownership}, owner=${app.owner}`);
            }
          }
        }
        const appsWithChildren = allApps.filter((app) => app.Children);
        if (appsWithChildren.length > 0) {
          console.log("📁 Apps with Children field:", appsWithChildren.map((app) => ({
            name: app.Name,
            children: app.Children,
            childrenType: typeof app.Children,
            isArray: Array.isArray(app.Children)
          })));
        }
        console.log("🎉 Final apps array before render");
        apps = allApps;
      } catch (e) {
        console.error(e);
        error = "Failed to load apps.";
      } finally {
        loading = false;
      }
    }
    async function loadIconDataUrl(iconPath) {
      console.log("🔵 loadIconDataUrl called with:", iconPath);
      if (iconCache.has(iconPath)) {
        console.log("📦 Icon cache hit:", iconPath);
        const cached = iconCache.get(iconPath) || "";
        console.log("📦 Returning cached icon, length:", cached.length);
        return cached;
      }
      try {
        console.log("📥 Step 1: Loading icon from disk via Rust...", iconPath);
        const iconDataUrl = await invoke("load_icon_base64", { path: iconPath });
        console.log("✅ Step 1 complete: Icon loaded, size:", iconDataUrl.length, "chars");
        console.log("🔍 Data URL preview (first 100 chars):", iconDataUrl.substring(0, 100));
        const ext = iconPath.split(".").pop()?.toLowerCase();
        console.log("🔍 File extension detected:", ext);
        let finalDataUrl = iconDataUrl;
        if (ext === "icns") {
          console.log("🔄 Step 2: File is .icns, starting PNG extraction...");
          console.log("   Step 2a: Splitting data URL to get base64 part...");
          const base64Data = iconDataUrl.split(",")[1];
          console.log("   Step 2b: Base64 data length:", base64Data.length);
          console.log("   Step 2c: Decoding base64 to binary string...");
          const binaryString = atob(base64Data);
          console.log("   Step 2d: Binary string length:", binaryString.length);
          console.log("   Step 2e: Converting to Uint8Array...");
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          console.log("   Step 2f: Uint8Array created, length:", bytes.length);
          const arrayBuffer = bytes.buffer;
          console.log("   Step 2g: ArrayBuffer created, byteLength:", arrayBuffer.byteLength);
          console.log("   Step 2h: Calling extractPngFromIcnsBuffer...");
          finalDataUrl = await extractPngFromIcnsBuffer(arrayBuffer);
          console.log("✅ Step 2 complete: PNG extracted, size:", finalDataUrl.length, "chars");
          console.log("🔍 Extracted PNG preview (first 100 chars):", finalDataUrl.substring(0, 100));
        } else {
          console.log("⏭️ Step 2: Skipped (not .icns file)");
        }
        console.log("💾 Step 3: Caching data URL...");
        iconCache.set(iconPath, finalDataUrl);
        console.log("✅ Step 3 complete: Data URL cached");
        console.log("🎉 loadIconDataUrl complete, returning data URL");
        return finalDataUrl;
      } catch (e) {
        console.error("❌ Failed to load icon from path:", iconPath);
        console.error("   Error details:", e);
        return "";
      }
    }
    async function extractPngFromIcnsBuffer(arrayBuffer) {
      console.log("🟢 extractPngFromIcnsBuffer called, buffer size:", arrayBuffer.byteLength);
      const view = new DataView(arrayBuffer);
      console.log("   Checking magic number...");
      const magic = view.getUint32(0);
      console.log("   Magic number:", magic.toString(16), "(expected: 69636e73)");
      if (magic !== 1768124019) {
        console.error("❌ Invalid magic number!");
        throw new Error("Not a valid .icns file (invalid magic number)");
      }
      console.log("   ✅ Valid .icns magic number confirmed");
      console.log("🔍 Searching for PNG data in .icns container...");
      let offset = 8;
      const fileSize = arrayBuffer.byteLength;
      console.log("   File size:", fileSize, "bytes, starting at offset 8");
      let chunkCount = 0;
      while (offset < fileSize - 8) {
        chunkCount++;
        const typeBuffer = new Uint8Array(arrayBuffer, offset, 4);
        const typeStr = String.fromCharCode(...typeBuffer);
        const chunkSize = view.getUint32(offset + 4, false);
        console.log(`  Chunk #${chunkCount}: type="${typeStr}", size=${chunkSize}, offset=${offset}`);
        if (["ic09", "ic08", "ic07", "ic06", "it32"].includes(typeStr)) {
          console.log(`    🎯 Found target chunk type: ${typeStr}`);
          const chunkDataStart = offset + 8;
          const chunkDataSize = chunkSize - 8;
          console.log(`    Chunk data: start=${chunkDataStart}, size=${chunkDataSize}`);
          const chunkData = new Uint8Array(arrayBuffer, chunkDataStart, chunkDataSize);
          console.log(`    Checking for PNG magic in chunk data (first 4 bytes: ${chunkData[0]?.toString(16)} ${chunkData[1]?.toString(16)} ${chunkData[2]?.toString(16)} ${chunkData[3]?.toString(16)})`);
          if (chunkData.length >= 4 && chunkData[0] === 137 && chunkData[1] === 80 && chunkData[2] === 78 && chunkData[3] === 71) {
            console.log(`✅ Found PNG in ${typeStr} chunk at offset ${chunkDataStart}, size: ${chunkData.length} bytes`);
            console.log("    Creating blob from PNG data...");
            const blob = new Blob([chunkData], { type: "image/png" });
            console.log("    Blob created, size:", blob.size, "bytes");
            console.log("    Converting blob to data URL via FileReader...");
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result;
                console.log(`✅ FileReader complete: data URL length ${dataUrl.length} chars`);
                console.log(`   Data URL preview: ${dataUrl.substring(0, 60)}...`);
                resolve(dataUrl);
              };
              reader.onerror = (err) => {
                console.error("❌ FileReader error:", err);
                reject(new Error("Failed to read PNG blob"));
              };
              reader.readAsDataURL(blob);
            });
          }
        }
        offset += chunkSize;
      }
      throw new Error("No PNG data found in .icns file");
    }
    function dataUrlToBlobUrl(dataUrl) {
      console.log("🟣 dataUrlToBlobUrl called, input length:", dataUrl.length);
      console.log("   Input preview (first 100 chars):", dataUrl.substring(0, 100));
      try {
        console.log("   Step 1: Matching data URL pattern...");
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          console.warn("⚠️ Invalid data URL format - no match!");
          console.warn("   Input was:", dataUrl.substring(0, 150));
          console.warn("   Returning original data URL");
          return dataUrl;
        }
        console.log("   ✅ Pattern matched");
        const mimeType = match[1];
        const base64Data = match[2];
        console.log(`   Step 2: MIME type: ${mimeType}, base64 length: ${base64Data.length}`);
        console.log("   Step 3: Decoding base64...");
        const binaryString = atob(base64Data);
        console.log(`   Step 4: Binary string length: ${binaryString.length}`);
        console.log("   Step 5: Converting to Uint8Array...");
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        console.log(`   ✅ Uint8Array created: ${bytes.length} bytes`);
        console.log("   Step 6: Creating Blob...");
        const blob = new Blob([bytes], { type: mimeType });
        console.log(`   ✅ Blob created: size=${blob.size} bytes, type=${blob.type}`);
        console.log("   Step 7: Creating object URL...");
        const blobUrl = URL.createObjectURL(blob);
        console.log("   ✅ Blob URL created:", blobUrl);
        console.log("🎉 dataUrlToBlobUrl complete, returning blob URL");
        return blobUrl;
      } catch (blobError) {
        console.error("❌ dataUrlToBlobUrl failed with error:", blobError);
        console.error("   Error stack:", blobError.stack);
        console.error("   Falling back to original data URL");
        return dataUrl;
      }
    }
    onDestroy(() => {
      endReorderDragSession();
    });
    onDestroy(() => {
    });
    function onResize() {
      windowWidth = window.innerWidth;
      updateEffectiveSize();
      if (expandedAppId) {
        positionChildMenu();
      }
    }
    function updateEffectiveSize() {
      const overallGridWidth = gridColumns * iconSize + (gridColumns - 1) * iconPadding;
      const requiredWidth = marginMin * 2 + overallGridWidth;
      if (windowWidth < requiredWidth) {
        const availableForGrid = Math.max(0, windowWidth - marginMin * 2);
        const perCol = Math.floor((availableForGrid - (gridColumns - 1) * iconPadding) / gridColumns);
        effectiveIconSize = Math.max(48, perCol);
      } else {
        effectiveIconSize = iconSize;
      }
      updateEffectiveTextSize();
    }
    function updateEffectiveTextSize() {
      const minTextPx = 11;
      const scale = effectiveIconSize / iconSize;
      const computed = Math.max(minTextPx, Math.floor(textSize * scale));
      effectiveTextSize = computed;
    }
    function updateIconRadius() {
      try {
        const root = document.documentElement;
        root.style.setProperty("--icon-radius", `${appIconRadius}px`);
      } catch (e) {
      }
    }
    async function handleDragOver(e) {
      const dragEvent = e;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      dragActive = true;
      externalFileDragActive = isExternalFileDrag(dragEvent);
      console.log("🖱️ Drag over detected");
    }
    async function handleDragLeave(e) {
      const dragEvent = e;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      dragActive = false;
      if (!dragEvent.relatedTarget) {
        externalFileDragActive = false;
        resetChildDropState();
      }
      console.log("🖱️ Drag leave detected");
    }
    async function handleDrop(e) {
      const dragEvent = e;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      dragActive = false;
      externalFileDragActive = false;
      const isChildDetachDrag = !!childMenuDragChildId && !!childMenuDragParentId && dragEvent.dataTransfer && Array.from(dragEvent.dataTransfer.types || []).includes(CHILD_DETACH_MIME);
      if (isChildDetachDrag) {
        dragEvent.target;
        if (childMenuDragChildId) {
          await detachChildFromParent(childMenuDragChildId);
        }
        resetChildDropState();
        endChildMenuDrag();
        return;
      }
      resetChildDropState();
      const files = dragEvent.dataTransfer?.files;
      if (!files || files.length === 0) {
        return;
      }
      const appPaths = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileObj = file;
        let filePath = fileObj.path || fileObj.webkitRelativePath || file.name;
        if (!filePath) {
          continue;
        }
        const ext = filePath.split(".").pop()?.toLowerCase();
        if (["png", "ico", "icns"].includes(ext || "")) {
          {
            console.log("⏭️ Icon file dropped but edit pane not open - ignoring");
            continue;
          }
        }
        if (!["app", "lnk", "exe"].includes(ext || "")) {
          console.log("⏭️ Ignoring non-app file:", filePath);
          continue;
        }
        appPaths.push(filePath);
      }
      if (appPaths.length > 0) {
        const dropKey = makeDropKey(appPaths);
        if (shouldSkipDuplicateDrop("dom", dropKey)) {
          console.log("⏭️ Skipping DOM drop (already handled by Tauri)");
          return;
        }
        await processAppDropPaths(appPaths);
        recordDropHandled("dom", dropKey);
      }
    }
    async function processAppDropPaths(paths, parentIdForDrop) {
      if (!paths || paths.length === 0) {
        return;
      }
      {
        error = "No user selected. Please select a user to add apps.";
        setTimeout(
          () => {
            error = null;
          },
          3e3
        );
        return;
      }
    }
    async function detachChildFromParent(childId) {
      const childApp = apps.find((app) => app.id === childId);
      if (!childApp) {
        return;
      }
      try {
        await updateAirtableApp(childId, { Parent: [] });
        const childName = childApp.Name || "App";
        successMessage = `${childName} moved to the main grid`;
        setTimeout(
          () => {
            successMessage = null;
          },
          15e3
        );
        if (!appOrder.includes(childId)) {
          const nextOrder = [...appOrder, childId];
          appOrder = nextOrder;
          if (selectedUserId) ;
        }
        await refreshApps();
      } catch (err) {
        console.error("❌ Failed to detach child app:", err);
        error = `Failed to detach app: ${err instanceof Error ? err.message : err}`;
        setTimeout(
          () => {
            error = null;
          },
          5e3
        );
      }
    }
    onDestroy(() => {
      window.removeEventListener("resize", onResize);
      const container = document.querySelector(".container");
      if (container) {
        container.removeEventListener("dragover", handleDragOver);
        container.removeEventListener("dragleave", handleDragLeave);
        container.removeEventListener("drop", handleDrop);
      }
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("drop", handleDrop);
    });
    combinedChildHoverCandidateId = dragHoverCandidateId ?? reorderHoldCandidateId;
    combinedChildReadyParentId = dragChildParentId ?? reorderChildReadyId;
    {
      const trimmedQuery = searchQuery.trim();
      const queryActive = trimmedQuery !== "";
      searchActive = queryActive;
      const normalizedQuery = trimmedQuery.toLowerCase();
      let filtered = apps.filter((app) => {
        if (queryActive) {
          const matchesName = app.Name?.toLowerCase().includes(normalizedQuery);
          if (!matchesName) return false;
        }
        const isChildApp = app.Parent && Array.isArray(app.Parent) && app.Parent.length > 0;
        if (isChildApp && !queryActive) {
          return false;
        }
        if (app.ownership === "Global") {
          return true;
        } else if (app.ownership === "Public") {
          return false;
        } else if (app.ownership === "Private") {
          {
            return false;
          }
        }
        return false;
      });
      if (appOrder && appOrder.length > 0) {
        filtered.sort((a, b) => {
          const indexA = appOrder.indexOf(a.id);
          const indexB = appOrder.indexOf(b.id);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return 0;
        });
      }
      filteredApps = filtered;
    }
    expandedParentApp = expandedAppId ? apps.find((app) => app.id === expandedAppId) ?? null : null;
    if (!expandedParentApp) {
      expandedChildApps = [];
    } else if (expandedParentApp.Children && Array.isArray(expandedParentApp.Children)) {
      const nextChildren = apps.filter((candidate) => expandedParentApp.Children?.includes(candidate.id));
      expandedChildApps = nextChildren;
      if (expandedChildApps.length === 0) {
        closeChildMenu();
      }
    }
    {
      let browserFiltered = apps.filter((app) => {
        if (searchQuery.trim() !== "") {
          const query = searchQuery.toLowerCase();
          const matchesName = app.Name?.toLowerCase().includes(query);
          if (!matchesName) return false;
        }
        if (app.Parent && Array.isArray(app.Parent) && app.Parent.length > 0) {
          return false;
        }
        if (app.ownership === "Private") {
          return false;
        } else if (app.ownership === "Global") {
          return false;
        } else if (app.ownership === "Public") {
          return false;
        }
        return false;
      });
      filteredBrowserApps = browserFiltered;
    }
    (() => {
      const currentChildOwned = true;
      const baseOptions = Array.isArray(filteredApps) ? filteredApps.filter((app) => app.id !== "" && userOwnsApp() && currentChildOwned) : [];
      return baseOptions;
    })();
    {
      updateEffectiveSize();
    }
    {
      updateEffectiveTextSize();
    }
    updateIconRadius();
    if (apps && apps.length > 0) {
      const parsecApp = apps.find((a) => a.Name === "Parsec");
      if (parsecApp) {
        console.log("🔎 Parsec app state:", {
          Name: parsecApp.Name,
          Target: parsecApp.Target,
          hasIcon: !!parsecApp.Icon,
          iconLength: parsecApp.Icon?.length,
          icon0Path: parsecApp.Icon?.[0]?.path,
          icon0Url: parsecApp.Icon?.[0]?.url ? "(exists)" : "(none)",
          icon0IconDataUrl: parsecApp.Icon?.[0]?.iconDataUrl ? `(${parsecApp.Icon[0].iconDataUrl.substring(0, 50)}...)` : "(none)"
        });
      }
    }
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="drop-zone svelte-1uha8ag" role="button" tabindex="0"></div>`);
    }
    $$renderer2.push(`<!--]--> <div class="app-container svelte-1uha8ag" role="main"><div class="title-section svelte-1uha8ag">`);
    {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<button class="title-button svelte-1uha8ag" aria-label="Click to search apps">Atlas Launcher</button> <button class="search-icon-btn svelte-1uha8ag" aria-label="Search apps">`);
      Search($$renderer2, { size: 28 });
      $$renderer2.push(`<!----></button>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    if (error) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="error svelte-1uha8ag">${escape_html(error)}</p>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <div class="apps-section svelte-1uha8ag"><div class="section-header svelte-1uha8ag"><h2 class="svelte-1uha8ag">Apps</h2> <div class="section-header-actions svelte-1uha8ag">`);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <button class="collapse-btn svelte-1uha8ag"${attr("aria-label", "Collapse")}>`);
    {
      $$renderer2.push("<!--[-->");
      Chevron_down($$renderer2, { size: 20 });
    }
    $$renderer2.push(`<!--]--></button></div></div> `);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<main${attr_class("container svelte-1uha8ag", void 0, { "drag-active": dragActive })}>`);
      if (loading) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<p>Loading apps...</p>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<div class="grid svelte-1uha8ag"${attr_style(` /* Auto-fit columns based on icon size */ grid-template-columns: repeat(auto-fit, ${stringify(effectiveIconSize)}px); gap: ${stringify(iconPadding)}px; --icon-size: ${stringify(effectiveIconSize)}px; --icon-radius: ${stringify(appIconRadius)}px; `)}><!--[-->`);
        const each_array = ensure_array_like(filteredApps);
        for (let index = 0, $$length = each_array.length; index < $$length; index++) {
          let app = each_array[index];
          $$renderer2.push(`<div class="app-with-insert-indicator svelte-1uha8ag"><button type="button"${attr_class("icon-wrapper svelte-1uha8ag", void 0, {
            "no-icon": !app.Icon || !app.Icon[0],
            "is-public-not-added": app.ownership === "Public" && selectedUser,
            "single-search-result": filteredApps.length === 1 && searchQuery.trim() !== "",
            "has-children": app.Children && Array.isArray(app.Children) && app.Children.length > 0,
            "child-menu-open": expandedAppId === app.id,
            "child-drop-pending": combinedChildHoverCandidateId === app.id,
            "child-drop-ready": combinedChildReadyParentId === app.id
          })}${attr("data-app-button", app.id)}${attr("aria-label", `${stringify(app.Children && Array.isArray(app.Children) && app.Children.length > 0 ? "Show child apps for" : "Launch")} ${stringify(app.Name)}`)}${attr("aria-haspopup", app.Children && Array.isArray(app.Children) && app.Children.length > 0 ? "menu" : void 0)}${attr("aria-expanded", app.Children && Array.isArray(app.Children) && app.Children.length > 0 ? expandedAppId === app.id : void 0)}><div class="icon-container svelte-1uha8ag">`);
          if (app.Icon && app.Icon[0] && (app.Icon[0].url || app.Icon[0].iconDataUrl)) {
            $$renderer2.push("<!--[-->");
            if (app.Icon[0].url) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<img${attr("src", app.Icon[0].url)} alt="" crossorigin="anonymous"${attr_style(`--icon-zoom: ${stringify(iconZoomFactors[app.id] || 0)};`)} class="svelte-1uha8ag"/>`);
            } else {
              $$renderer2.push("<!--[!-->");
              if (app.Icon[0].iconDataUrl) {
                $$renderer2.push("<!--[-->");
                $$renderer2.push(`<img${attr("src", (() => {
                  console.log(`🖼️ Rendering image for ${app.Name}`);
                  console.log(`   iconDataUrl length: ${app.Icon[0].iconDataUrl.length}`);
                  console.log(`   iconDataUrl preview: ${app.Icon[0].iconDataUrl.substring(0, 100)}`);
                  const blobUrl = dataUrlToBlobUrl(app.Icon[0].iconDataUrl);
                  console.log(`   Converted to blob URL: ${blobUrl}`);
                  return blobUrl;
                })())} alt="" crossorigin="anonymous"${attr_style(`--icon-zoom: ${stringify(iconZoomFactors[app.id] || 0)};`)} class="svelte-1uha8ag"/>`);
              } else {
                $$renderer2.push("<!--[!-->");
              }
              $$renderer2.push(`<!--]-->`);
            }
            $$renderer2.push(`<!--]-->`);
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push(`<div class="placeholder-icon svelte-1uha8ag"${attr_style(`width:${stringify(effectiveIconSize)}px; height:${stringify(effectiveIconSize)}px;`)}>📦</div>`);
          }
          $$renderer2.push(`<!--]--> `);
          if (!searchActive && app.Children && Array.isArray(app.Children) && app.Children.length > 0) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<div class="child-folder-badge svelte-1uha8ag"${attr_style(`--child-badge-size:${stringify(Math.max(18, effectiveIconSize * 0.22))}px;`)} aria-hidden="true">`);
            Folder_open($$renderer2, { size: Math.max(18, effectiveIconSize * 0.22) });
            $$renderer2.push(`<!----></div>`);
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (app.ownership === "Public" && selectedUser) ;
          else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (combinedChildReadyParentId === app.id) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<div class="nest-overlay svelte-1uha8ag" aria-hidden="true">`);
            Folder_plus($$renderer2, { size: Math.max(24, effectiveIconSize * 0.4) });
            $$renderer2.push(`<!----></div>`);
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--></div> <p${attr_style(`font-size:${stringify(effectiveTextSize)}px;`)} class="svelte-1uha8ag">${escape_html(app.Name)}</p></button></div>`);
        }
        $$renderer2.push(`<!--]--> `);
        {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<button type="button" class="icon-wrapper add-new-button svelte-1uha8ag" aria-label="Add new app" style="--add-button-size: max(28px, calc(var(--icon-size) * 0.4));"><div class="add-new-icon svelte-1uha8ag">`);
          Plus($$renderer2, { size: Math.max(14, effectiveIconSize * 0.2) });
          $$renderer2.push(`<!----></div> <p${attr_style(`font-size:${stringify(effectiveTextSize)}px; visibility: hidden;`)} class="svelte-1uha8ag">Add New</p></button>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></main>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (expandedAppId && expandedChildApps.length > 0 && childMenuPosition) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="child-menu svelte-1uha8ag"${attr_style(`top: ${stringify(childMenuPosition.top)}px; left: ${stringify(childMenuPosition.left)}px;`)}${attr("data-side", childMenuPosition.side)} role="menu" tabindex="0"${attr("aria-label", `Child apps for ${stringify(expandedParentApp?.Name)}`)}><div class="child-menu-header svelte-1uha8ag"><span>${escape_html(expandedParentApp?.Name)}</span> <button type="button" class="child-menu-close svelte-1uha8ag" aria-label="Close child menu">`);
      X($$renderer2, { size: 16 });
      $$renderer2.push(`<!----></button></div> <div class="child-menu-list svelte-1uha8ag"><!--[-->`);
      const each_array_1 = ensure_array_like(expandedChildApps);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let child = each_array_1[$$index_1];
        $$renderer2.push(`<button type="button" class="child-menu-item svelte-1uha8ag"${attr("draggable", true)} role="menuitem"><span class="child-menu-item-icon svelte-1uha8ag">`);
        if (child.Icon && child.Icon[0] && (child.Icon[0].url || child.Icon[0].iconDataUrl)) {
          $$renderer2.push("<!--[-->");
          if (child.Icon[0].url) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<img${attr("src", child.Icon[0].url)} alt="" crossorigin="anonymous"${attr_style(`--icon-zoom: ${stringify(iconZoomFactors[child.id] || 0)};`)} class="svelte-1uha8ag"/>`);
          } else {
            $$renderer2.push("<!--[!-->");
            if (child.Icon[0].iconDataUrl) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<img${attr("src", dataUrlToBlobUrl(child.Icon[0].iconDataUrl))} alt="" crossorigin="anonymous"${attr_style(`--icon-zoom: ${stringify(iconZoomFactors[child.id] || 0)};`)} class="svelte-1uha8ag"/>`);
            } else {
              $$renderer2.push("<!--[!-->");
            }
            $$renderer2.push(`<!--]-->`);
          }
          $$renderer2.push(`<!--]-->`);
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push(`<span class="child-menu-placeholder svelte-1uha8ag">📦</span>`);
        }
        $$renderer2.push(`<!--]--></span> <span class="child-menu-item-label svelte-1uha8ag">${escape_html(child.Name)}</span></button>`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <footer class="svelte-1uha8ag"><div class="footer-left svelte-1uha8ag"><span class="version svelte-1uha8ag">v0.1.0</span> `);
    if (successMessage) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<span class="footer-separator svelte-1uha8ag">•</span> <span class="success-message svelte-1uha8ag">${escape_html(successMessage)}</span>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="footer-controls svelte-1uha8ag">`);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <button class="refresh-btn svelte-1uha8ag" title="Refresh apps">`);
    Rotate_cw($$renderer2, { size: 20 });
    $$renderer2.push(`<!----></button> <button class="settings-btn svelte-1uha8ag" title="Settings">`);
    Settings($$renderer2, { size: 20 });
    $$renderer2.push(`<!----></button></div></footer> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (searchQuery.trim()) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="available-apps-section svelte-1uha8ag"><div class="section-header svelte-1uha8ag"><h2 class="svelte-1uha8ag">Available Apps</h2></div> <main class="container svelte-1uha8ag">`);
      if (filteredBrowserApps.length === 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<p class="no-apps-message svelte-1uha8ag">No apps available to add</p>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<div class="grid browser-grid svelte-1uha8ag"${attr_style(` grid-template-columns: repeat(auto-fit, ${stringify(effectiveIconSize)}px); gap: ${stringify(iconPadding)}px; --icon-size: ${stringify(effectiveIconSize)}px; --icon-radius: ${stringify(appIconRadius)}px; `)}><!--[-->`);
        const each_array_5 = ensure_array_like(filteredBrowserApps);
        for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
          let app = each_array_5[$$index_5];
          $$renderer2.push(`<div class="app-with-insert-indicator svelte-1uha8ag"><button type="button"${attr_class("icon-wrapper browser-app-button svelte-1uha8ag", void 0, { "no-icon": !app.Icon || !app.Icon[0] })}${attr("aria-label", `View ${stringify(app.Name)}`)}><div class="icon-container svelte-1uha8ag">`);
          if (app.Icon && app.Icon[0] && (app.Icon[0].url || app.Icon[0].iconDataUrl)) {
            $$renderer2.push("<!--[-->");
            if (app.Icon[0].url) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`<img${attr("src", app.Icon[0].url)} alt="" crossorigin="anonymous"${attr_style(`--icon-zoom: ${stringify(iconZoomFactors[app.id] || 0)};`)} class="svelte-1uha8ag"/>`);
            } else {
              $$renderer2.push("<!--[!-->");
              if (app.Icon[0].iconDataUrl) {
                $$renderer2.push("<!--[-->");
                $$renderer2.push(`<img${attr("src", dataUrlToBlobUrl(app.Icon[0].iconDataUrl))} alt="" crossorigin="anonymous"${attr_style(`--icon-zoom: ${stringify(iconZoomFactors[app.id] || 0)};`)} class="svelte-1uha8ag"/>`);
              } else {
                $$renderer2.push("<!--[!-->");
              }
              $$renderer2.push(`<!--]-->`);
            }
            $$renderer2.push(`<!--]-->`);
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push(`<div class="placeholder-icon svelte-1uha8ag"${attr_style(`width:${stringify(effectiveIconSize)}px; height:${stringify(effectiveIconSize)}px;`)}>📦</div>`);
          }
          $$renderer2.push(`<!--]--> `);
          if (!searchActive && app.Children && Array.isArray(app.Children) && app.Children.length > 0) {
            $$renderer2.push("<!--[-->");
            $$renderer2.push(`<div class="child-folder-badge svelte-1uha8ag"${attr_style(`--child-badge-size:${stringify(Math.max(18, effectiveIconSize * 0.22))}px;`)} aria-hidden="true">`);
            Folder_open($$renderer2, { size: Math.max(18, effectiveIconSize * 0.22) });
            $$renderer2.push(`<!----></div>`);
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--> <div class="browser-overlay svelte-1uha8ag"><div class="add-browser-app-btn svelte-1uha8ag" role="button" tabindex="0"${attr("aria-label", `Add ${stringify(app.Name)}`)}>`);
          Plus($$renderer2, { size: 24 });
          $$renderer2.push(`<!----></div></div></div> <p${attr_style(`font-size:${stringify(effectiveTextSize)}px;`)} class="svelte-1uha8ag">${escape_html(app.Name)}</p></button></div>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></main></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
