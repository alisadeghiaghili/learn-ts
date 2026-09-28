/** Lightweight markdown-ish modal. */

export function renderMarkdown(md: string): string {
  return md
    .split(/\n\n+/)
    .map((block) => {
      if (block.startsWith("### ")) return `<h3>${inline(block.slice(4))}</h3>`;
      if (block.startsWith("## ")) return `<h2>${inline(block.slice(3))}</h2>`;
      if (block.startsWith("- ")) {
        const items = block
          .split("\n")
          .map((l) => `<li>${inline(l.replace(/^- /, ""))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${inline(block)}</p>`;
    })
    .join("\n");
}

function inline(s: string): string {
  return s
    .replaceAll(/`([^`]+)`/g, "<code>$1</code>")
    .replaceAll(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

export function showModal(html: string, onClose?: () => void): void {
  const existing = document.querySelector(".modal-backdrop");
  existing?.remove();
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  back.addEventListener("click", (e) => {
    if (e.target === back) {
      back.remove();
      onClose?.();
    }
  });
  const closeBtn = back.querySelector("[data-close]");
  closeBtn?.addEventListener("click", () => {
    back.remove();
    onClose?.();
  });
  document.body.appendChild(back);
  const first = back.querySelector<HTMLButtonElement>("button");
  first?.focus();
}

export function closeModal(): void {
  document.querySelector(".modal-backdrop")?.remove();
}
