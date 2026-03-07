import { createRenderer } from 'solid-js/universal';

export interface TuiElement {
  type: 'Box' | 'Text';
  props: any;
  children: TuiElement[];
}

const parentMap = new WeakMap<TuiElement, TuiElement>();

let idCounter = 0;

export const Fragment = (props: any) => props.children;

export const {
  render,
  effect,
  memo,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  mergeProps,
} = createRenderer<TuiElement | any>({
  createElement(tag) {
    const type = (tag.charAt(0).toUpperCase() + tag.slice(1)) as any;
    const node = {
      __id: ++idCounter,
      type,
      props: {},
      children: [],
    };
    return node;
  },
  createTextNode(value) {
    const node = {
      __id: ++idCounter,
      type: 'Text',
      props: { content: String(value) },
      children: [],
    };
    return node;
  },
  replaceText(node, value) {
    node.props.content = String(value);
  },
  setProperty(node, name, value) {
    if (!node.props) node.props = {};
    node.props[name] = value;
  },
  insertNode(parent, node, anchor) {
    if (!parent || !node) return;
    if (!parent.children) parent.children = [];
    if (anchor) {
      const index = parent.children.indexOf(anchor);
      if (index !== -1) {
        parent.children.splice(index, 0, node);
      } else {
        parent.children.push(node);
      }
    } else {
      parent.children.push(node);
    }
    parentMap.set(node, parent);
  },
  isTextNode(node) {
    return node.type === 'Text';
  },
  removeNode(parent, node) {
    const index = parent.children.indexOf(node);
    if (index !== -1) {
      parent.children.splice(index, 1);
    }
    parentMap.delete(node);
  },
  getParentNode(node) {
    return parentMap.get(node);
  },
  getFirstChild(node) {
    return node.children[0];
  },
  getNextSibling(node) {
    const parent = parentMap.get(node);
    if (!parent) return undefined;
    const index = parent.children.indexOf(node);
    return parent.children[index + 1];
  },
});

export function h(tag: any, props: any, ...children: any[]) {
  if (typeof tag === 'function') {
    const mergedProps: any = { ...props };
    if (children.length > 0) {
      mergedProps.children = children.length <= 1 ? children[0] : children;
    }
    
    const finalProps: any = {};
    for (const key in mergedProps) {
      const value = mergedProps[key];
      if (typeof value === 'function' && !key.startsWith('on') && key !== 'children') {
        Object.defineProperty(finalProps, key, {
          get() { return value(); },
          enumerable: true,
          configurable: true
        });
      } else {
        finalProps[key] = value;
      }
    }
    return createComponent(tag, finalProps);
  }
  
  const el = createElement(tag);
  if (props) {
    for (const key in props) {
      if (key === 'children') continue;
      const value = props[key];
      if (typeof value === 'function' && !key.startsWith('on')) {
        effect(() => setProp(el, key, value()));
      } else {
        setProp(el, key, value);
      }
    }
  }

  const flatChildren = children.flat(Infinity);
  for (const child of flatChildren) {
    if (child === null || child === undefined) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      insertNode(el, createTextNode(String(child)));
    } else {
      insert(el, child);
    }
  }
  return el;
}

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      box: any;
      text: any;
    }
  }
}
