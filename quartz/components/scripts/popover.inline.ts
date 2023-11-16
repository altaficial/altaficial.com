import { computePosition, flip, inline, shift } from "@floating-ui/dom"

// from micromorph/src/utils.ts
// https://github.com/natemoo-re/micromorph/blob/main/src/utils.ts#L5
export function normalizeRelativeURLs(el: Element | Document, destination: string | URL) {
  const rebase = (el: Element, attr: string, newBase: string | URL) => {
    const rebased = new URL(el.getAttribute(attr)!, newBase)
    el.setAttribute(attr, rebased.pathname + rebased.hash)
  }

  el.querySelectorAll('[href^="./"], [href^="../"]').forEach((item) =>
    rebase(item, "href", destination),
  )
  el.querySelectorAll('[src^="./"], [src^="../"]').forEach((item) =>
    rebase(item, "src", destination),
  )
}

const p = new DOMParser()
async function mouseEnterHandler(
  this: HTMLLinkElement,
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  const link = this
  async function setPosition(popoverElement: HTMLElement) {
    const { x, y } = await computePosition(link, popoverElement, {
      middleware: [inline({ x: clientX, y: clientY }), shift(), flip()],
    })
    Object.assign(popoverElement.style, {
      left: `${x}px`,
      top: `${y}px`,
    })
  }

  const hasAlreadyBeenFetched = () =>
    [...link.children].some((child) => child.classList.contains("popover"))

  // dont refetch if there's already a popover
  if (hasAlreadyBeenFetched()) {
    return setPosition(link.lastChild as HTMLElement)
  }

  const thisUrl = new URL(document.location.href)
  thisUrl.hash = ""
  thisUrl.search = ""
  const targetUrl = new URL(link.href)
  const hash = targetUrl.hash
  targetUrl.hash = ""
  targetUrl.search = ""
  // prevent hover of the same page
  if (thisUrl.toString() === targetUrl.toString()) return

  const contents = await fetch(`${targetUrl}`)
    .then((res) => res.text())
    .catch((err) => {
      console.error(err)
    })

  // bailout if another popover exists
  if (hasAlreadyBeenFetched()) {
    return
  }

  if (!contents) return
  const html = p.parseFromString(contents, "text/html")
  normalizeRelativeURLs(html, targetUrl)
  const elts = [...html.getElementsByClassName("popover-hint")]
  if (elts.length === 0) return

  const popoverElement = document.createElement("div")
  popoverElement.classList.add("popover")
  const popoverInner = document.createElement("div")
  popoverInner.classList.add("popover-inner")
  popoverElement.appendChild(popoverInner)
  elts.forEach((elt) => popoverInner.appendChild(elt))

  setPosition(popoverElement)
  link.appendChild(popoverElement)

  if (hash !== "") {
    const heading = popoverInner.querySelector(hash) as HTMLElement | null
    if (heading) {
      // leave ~12px of buffer when scrolling to a heading
      popoverInner.scroll({ top: heading.offsetTop - 12, behavior: "instant" })
    }
  }
}

document.addEventListener("nav", () => {
  const links = [...document.getElementsByClassName("internal")] as HTMLLinkElement[]
  for (const link of links) {
    link.removeEventListener("mouseenter", mouseEnterHandler)
    link.addEventListener("mouseenter", mouseEnterHandler)
  }
})
