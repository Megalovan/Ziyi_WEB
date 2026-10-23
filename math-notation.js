/* Locally hosted MathJax renders the same LaTeX in controls and PNG exports. */
(() => {
  const nodes = new Map();
  const images = new Map();
  let initialized = false;
  const ready = window.MathJax.startup.promise.then(() => { initialized = true; });

  function svgFor(tex) {
    if (!nodes.has(tex)) {
      const wrapper = window.MathJax.tex2svg(tex, {display: false});
      const svg = wrapper.querySelector('svg');
      svg.setAttribute('data-latex', tex);
      nodes.set(tex, svg);
    }
    return nodes.get(tex).cloneNode(true);
  }

  function typeset(element, tex, accessibleText) {
    element.dataset.latex = tex;
    element.setAttribute('aria-label', accessibleText);
    if (!initialized) { element.textContent = accessibleText; return; }
    if (element.dataset.renderedLatex === tex) return;
    const svg = svgFor(tex);
    svg.setAttribute('aria-hidden', 'true');
    element.replaceChildren(svg);
    element.dataset.renderedLatex = tex;
  }

  async function image(tex, color) {
    await ready;
    const key = tex + '|' + color;
    if (!images.has(key)) {
      images.set(key, new Promise((resolve, reject) => {
        const svg = svgFor(tex);
        const [, , width, height] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        svg.setAttribute('color', color);
        svg.querySelectorAll('[fill="currentColor"]').forEach(node => node.setAttribute('fill', color));
        svg.querySelectorAll('[stroke="currentColor"]').forEach(node => node.setAttribute('stroke', color));
        const img = new Image();
        img.onload = () => resolve({img, width: width / 1000, height: height / 1000});
        img.onerror = () => reject(new Error('Could not render LaTeX figure label.'));
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      }));
    }
    return images.get(key);
  }

  function draw(ctx, label, x, baseline, size, align = 'left') {
    const width = label.width * size, height = label.height * size;
    ctx.drawImage(label.img, align === 'right' ? x - width : x, baseline - height, width, height);
  }

  window.MathNotation = {ready, typeset, image, draw};
})();
