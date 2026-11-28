import { bindEach } from "@wocart/theme/lifecycle";

bindEach<HTMLElement>("[data-contact-widget]", (root) => {
  const launcher = root.querySelector<HTMLButtonElement>("[data-contact-launcher]");
  const panel = root.querySelector<HTMLElement>("[data-contact-panel]");
  const close = root.querySelector<HTMLButtonElement>("[data-contact-close]");
  if (!launcher || !panel || !close) return;

  const setOpen = (open: boolean, restoreFocus = false) => {
    root.dataset.open = String(open);
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    if (restoreFocus) launcher.focus();
  };

  const onToggle = () => setOpen(root.dataset.open !== "true");
  const onClose = () => setOpen(false, true);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && root.dataset.open === "true") setOpen(false, true);
  };
  const onDocumentClick = (event: MouseEvent) => {
    if (root.dataset.open === "true" && event.target instanceof Node && !root.contains(event.target)) setOpen(false);
  };
  const onLinkClick = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
  };

  setOpen(false);
  launcher.addEventListener("click", onToggle);
  close.addEventListener("click", onClose);
  panel.addEventListener("click", onLinkClick);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("click", onDocumentClick);

  return () => {
    launcher.removeEventListener("click", onToggle);
    close.removeEventListener("click", onClose);
    panel.removeEventListener("click", onLinkClick);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("click", onDocumentClick);
  };
});
