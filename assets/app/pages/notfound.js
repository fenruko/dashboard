import { h, mount } from "../ui/dom.js";
import { button, card } from "../ui/components.js";
import { icon } from "../ui/icons.js";

export async function mountPage(ctx) {
  const host = ctx.root;
  const page = h(
    "div",
    { class: "main-scroll", style: "max-width:640px;margin:8vh auto" },
    card({
      children: [
        h("div", { class: "empty" }, h("span", { class: "empty-icon" }, icon("help", { size: 22 })), h("div", { class: "empty-title" }, "That page doesn't exist"), h("p", { class: "empty-msg" }, "The link may be old, or the section was renamed. Everything lives in the sidebar.")),
        h(
          "div",
          { class: "row", style: "justify-content:center" },
          button({ label: "Your servers", variant: "primary", icon: "grid", onClick: () => ctx.router.navigate("/guilds") }),
          button({ label: "Diagnostics", icon: "terminal", onClick: () => ctx.router.navigate("/status") })
        ),
      ],
    })
  );
  mount(host, page);
  return () => (host.innerHTML = "");
}
