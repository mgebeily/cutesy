import { CutesyCustomComponent } from "..";

export type DomNode = {
  type?: string;
  tagName: string;
  attributes: {[key:string]:string};
  styles: {[key:string]:string};
  classList: string[];
  children: DomNode[];
  content: string;
}

export const getJsonFromElement = (element: HTMLElement) => {
  const tagName = element.tagName;

  if (!tagName) {
    const content = element.textContent.trim();
    if (content) {
      return { tagName, attributes: {}, styles: {}, classList: [], content, children: []}
    } else {
      return null;
    }
  }

  const attributes: {[key:string]:string} = {};
  const styles: {[key:string]:string} = {};
  const classList = [];
  const children: DomNode[] = [];

  for(let x = 0; x < element.attributes.length; x++) {
    const name = element.attributes[x].name
    if (name === 'style') {
      Object.values(element.style).forEach((k: any) => {
        styles[k] = element.style[k];
      })
    } else if (name === 'class') {
      classList.push(...element.classList);
    } else if (!name.startsWith("data-cutesy-")) {
      attributes[element.attributes[x].name] = element.attributes[x].value;
    }
  }

  if (element.childElementCount === 0) {
    return { tagName, attributes, children, styles, classList, content: element.innerText } as DomNode;
  }

  for(let x = 0; x < element.childNodes.length; x++) {
    // TODO: Check that this doesn't exclude any content
    const child = getJsonFromElement(element.childNodes[x] as HTMLElement)
    if (child) {
      children.push(child);
    }
  }

  return { tagName, attributes, children, styles, classList, content: "" } as DomNode;
}

export const getElementFromJson = (node: DomNode, customComponents: CutesyCustomComponent[], path: string = null): HTMLElement => {
  // Create the proper tag name
  const element = document.createElement(node.tagName);

  // Set all the attributes
  for(const attribute in node.attributes) {
    element.setAttribute(attribute, node.attributes[attribute]);
  }

  // Set all the styles
  for(const style of Object.keys(node.styles) as any) {
    element.style[style] = node.styles[style];
  }

  // Set the classList
  for(const className of node.classList || []) {
    element.classList.add(className)
  }

  element.innerText += node.content || "";
  for(const index in node.children) {
    const child = node.children[index];

    // TODO: Test if this ever gets hit
    if (!child.tagName) {
      element.innerHTML += child.content;
    } else {
      const childElement = getElementFromJson(child, customComponents, path !== null ? `${path}/children/${index}` : null)
      const component = customComponents.find(({ identify }) => identify(child, childElement))

      if (component) {
        // If there is a custom component available for the child, re-render with its custom values.
        const customChildElement = component.render(child, childElement,
          (n) => getElementFromJson(n, customComponents, path !== null ? `${path}/children/${index}` : null))

        // If this is not for a dom render, cache the custom value type.
        if (path !== null && component.name) {
          customChildElement.setAttribute("data-cutesy-type", component.name)
        }
        element.appendChild(customChildElement)
      } else {
        element.appendChild(childElement)
      }
    }
  }

  // Get the node element
  if (path !== null) {
    element.setAttribute("draggable", "true")
    element.setAttribute("data-cutesy-path", path);
  }

  return element;
}
