import { createStore, FletchState } from "fletch-state";
import { debounce } from "./utils";
import { DomNode, getElementFromJson, getJsonFromElement } from "./virtual-dom";

type CutesyOptions = {
  customComponents?: CutesyCustomComponent[];
}

export type CutesyCustomComponent = {
  name: string;
  identify: (data: DomNode, element: HTMLElement) => void;
  render: (data: DomNode, element: HTMLElement, render: (data: DomNode) => HTMLElement) => HTMLElement;

  onCreate: (data: DomNode, element: HTMLElement) => Promise<boolean> | boolean;
  onSelect: (data: DomNode, element: HTMLElement) => Promise<boolean> | boolean;
  canDrop: (source: HTMLElement, target: HTMLElement) => Promise<boolean> | boolean;
}

type CutesyEditor = {
  getValue: () => string;
  getStore: () => FletchState;
}

export const initialize = (editorSelector: string, options: CutesyOptions = {}): CutesyEditor => {
  const { customComponents = [] } = options;

  // TODO: Keep singular?
  const element = document.querySelector(editorSelector) as HTMLElement;
  const draggableElements = document.querySelectorAll("[data-cutesy-draggable]");

   // Add the drop event to the editor
  // TODO: This
  if (!element.hasChildNodes()) {
    element.innerHTML = `<div></div>`;
  } else if (element.childElementCount > 1) {
    element.innerHTML = `<div>${element.innerHTML}</div>`
  }
  const initialStore = getJsonFromElement(element.firstElementChild as HTMLElement);
  element.replaceChildren(getElementFromJson(initialStore, customComponents, ""));

  // const shadow = element.attachShadow({ mode: "closed" });

  // Create the default store
  // TODO: Load state
  // TODO: First element only? Inner HTML? Multiple?
  const store = createStore({ dom: initialStore })

  // Make sure the element itself is rendered to have the store state
  // TODO: Replace the child instead?
  // TODO: Conditional render?
  // TODO: Whymst this get the whole ass thing?
  store.subscribe("/dom", ({ dom }) => {
    element.innerHTML = getElementFromJson(dom, customComponents, "").outerHTML;
  });

  // Add the droparea value
  // TODO: Check if this needs aria attributes
  // TODO: Hover / drop before
  // When something is dropped in the element, get the innermost droppable location where it is dropped.
  // Create the element at that point.
  const dragover = debounce((e: DragEvent) => {
    // Remove hover attribute from other component
    const previouslyHoveredElement = element.querySelector("[data-cutesy-drop-hovered]");
    if (previouslyHoveredElement && previouslyHoveredElement !== e.target) {
      previouslyHoveredElement.removeAttribute("data-cutesy-drop-hovered")
    }
    const component = customComponents.find(({ name }) => (e.target as HTMLElement).getAttribute("data-cutesy-type") === name)

    // TODO: Before / after inserting
    // const { x, y } = (e.target as HTMLElement).getBoundingClientRect();
    // const { offsetX, offsetY } = e;

    if (component && component.canDrop) {
      const value = e.dataTransfer.getData("text/plain")
      const dummyElement = document.createElement("div");
      dummyElement.innerHTML = value
      const draggedElement = dummyElement.firstElementChild;

      if (component.canDrop(draggedElement as HTMLElement, e.target as HTMLElement)) {
        (e.target as HTMLElement).setAttribute("data-cutesy-drop-hovered", "true")
      }
    } else {
      (e.target as HTMLElement).setAttribute("data-cutesy-drop-hovered", "true")
    }
  }, 1)
  element.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    dragover(e);
  });

  element.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", (e.target as HTMLElement).outerHTML)
  });

  element.addEventListener("dragenter", (e) => {
    // TODO: left, right, top, bottom
    (e.target as HTMLElement).setAttribute("data-cutesy-drag", "true");
  });

  element.addEventListener("dragleave", (e) => {
    (e.target as HTMLElement).removeAttribute("data-cutesy-drag");
  });

  element.addEventListener("click", (e) => {
    e.preventDefault();

    const selectedElement = element.querySelector("[data-cutesy-selected]");
    if (selectedElement) {
      selectedElement.removeAttribute("data-cutesy-selected");
    }

    (e.target as HTMLElement).setAttribute("data-cutesy-selected", "true")
  })

  element.addEventListener("drop", (e) => {
    e.preventDefault();

    const dummyElement = document.createElement("div")
    dummyElement.innerHTML = e.dataTransfer.getData("text");
    const droppedElement = dummyElement.firstElementChild;

    // TODO: Multiple children?
    // TODO: Check type to see if draggable
    // TODO: Prevent drop on parent
    // Get the template's first element
    // Find the location that the element should be dropped
    if (droppedElement.getAttribute("data-cutesy-path")) {
      const newPath = (e.target as HTMLElement).getAttribute("data-cutesy-path") || "/";
      const droppedPath = droppedElement.getAttribute("data-cutesy-path");
      const parentPath = droppedPath.substring(0, droppedPath.lastIndexOf("/"));
      const childIndex = parseInt(droppedPath.replace(`${parentPath}/`, ""))

      if (newPath.startsWith(droppedPath)) {
        return;
      }

      // Remove the moved value
      const data = store.retrieve("/dom");
      let here = data;
      for(const value of parentPath.replace("/", "").split("/")) {
        here = here[value];
      }
      here.splice(childIndex, 1)

      // Add the value to the target
      here = data;
      for(const value of newPath.replace("/", "").split("/")) {
        if (value) {
          here = here[value]
        }
      }
      here.children = here.children || [];
      droppedElement.setAttribute("data-cutesy-path", `${newPath}/children/${here.children.length}`)

      // TODO: What index is the new child?
      here.children = here.children.concat([getJsonFromElement(droppedElement as HTMLElement)])

      store.commit("/dom", data);
    } else if ((e.target as HTMLElement).getAttribute("data-cutesy-path")) {
      const path = `/dom${(e.target as HTMLElement).getAttribute("data-cutesy-path") || ""}`;
      const { children = [], ...data } = store.retrieve(path) as DomNode;
  
      // Get the resulting JSON
      // Mutate the data appropriately
      // TODO: Push instead of append?
      store.commit(path, { ...data, children: children.concat([getJsonFromElement(droppedElement as HTMLElement)])})
    }
  })

  draggableElements.forEach((draggableElement: Element) => {
    // Allow the element to be dragged
    draggableElement.setAttribute("draggable", "true");
    draggableElement.setAttribute("aria-dropeffect", "execute");

    // Add the dragging behavior
    (draggableElement as HTMLElement).addEventListener("dragstart", (e) => {
      // Add the proper accessibility attributes
      draggableElement.setAttribute("aria-grabbed", "true")

      // Add the data to be transferred on drag
      e.dataTransfer.setData("text/plain", draggableElement.querySelector("template").innerHTML);
    });

    // Add the dragging stop behavior (remove the aria attributes)
    draggableElement.addEventListener("dragend", (e) => {
      draggableElement.setAttribute("aria-grabbed", "false")
    })
  })

  return {
    getValue: () => getElementFromJson(store.retrieve("/"), customComponents).outerHTML,
    getStore: () => store
  }
}
