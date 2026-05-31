const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

if (sessionStorage.getItem("forceTop") === "1") {
  sessionStorage.removeItem("forceTop");
  window.scrollTo({ top: 0, behavior: "auto" });
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const parseColor = (value) => {
  if (!value) {
    return { r: 255, g: 255, b: 255 };
  }
  const hexMatch = value.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  const rgbMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }
  return { r: 255, g: 255, b: 255 };
};

const mix = (a, b, t) => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

const rgba = (color, alpha) => `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;

const readPalette = () => {
  const styles = getComputedStyle(document.body);
  return {
    accent: parseColor(styles.getPropertyValue("--accent").trim()),
    accent2: parseColor(styles.getPropertyValue("--accent-2").trim()),
    ink: parseColor(styles.getPropertyValue("--ink").trim()),
  };
};

const initMatrix = () => {
  const matrixCanvas = document.getElementById("matrixCanvas");
  if (!matrixCanvas) {
    return;
  }
  const ctx = matrixCanvas.getContext("2d");
  if (!ctx) {
    return;
  }

  let width = 0;
  let height = 0;
  let fontSize = 14;
  let columns = 0;
  let drops = [];
  let animationId = null;
  let lastTime = 0;
  let palette = readPalette();
  const glyphs = "0010011010100110".split("");

  const resizeCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    matrixCanvas.width = width * dpr;
    matrixCanvas.height = height * dpr;
    matrixCanvas.style.width = `${width}px`;
    matrixCanvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fontSize = Math.max(12, Math.min(18, Math.floor(width / 80)));
    columns = Math.floor(width / fontSize);
    drops = Array.from({ length: columns }, () => Math.random() * (height / fontSize));
  };

  const drawMatrix = (time) => {
    if (time - lastTime < 55 && !prefersReducedMotion) {
      animationId = requestAnimationFrame(drawMatrix);
      return;
    }
    lastTime = time;

    const nodeStart = Math.max(80, width * 0.1);
    const nodeEnd = width - nodeStart;

    ctx.fillStyle = "rgba(6, 10, 8, 0.25)";
    ctx.fillRect(0, 0, width, height);
    ctx.font = `600 ${fontSize}px "Syne", sans-serif`;
    ctx.textBaseline = "top";
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < columns; i += 1) {
      const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      const columnRight = x + fontSize;
      if (columnRight > nodeStart && x < nodeEnd) {
        if (y > height && Math.random() > 0.975) {
          drops[i] = 0;
        } else {
          drops[i] += 1;
        }
        continue;
      }

      const shimmer = 0.4 + 0.3 * Math.sin(time * 0.002 + i * 0.7);
      const color = mix(palette.accent2, palette.accent, 0.3 + shimmer * 0.5);
      ctx.fillStyle = rgba(color, 0.24 + shimmer * 0.35);
      ctx.fillText(glyph, x, y);

      if (y > height && Math.random() > 0.975) {
        drops[i] = 0;
      } else {
        drops[i] += 1;
      }
    }

    ctx.globalCompositeOperation = "source-over";
    if (!prefersReducedMotion) {
      animationId = requestAnimationFrame(drawMatrix);
    }
  };

  const start = () => {
    palette = readPalette();
    resizeCanvas();
    if (prefersReducedMotion) {
      ctx.clearRect(0, 0, width, height);
      drawMatrix(0);
      return;
    }
    animationId = requestAnimationFrame(drawMatrix);
  };

  const stop = () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };

  window.addEventListener("resize", resizeCanvas);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  start();
};

const initNeural = () => {
  const neuralCanvas = document.getElementById("neuralCanvas");
  if (!neuralCanvas) {
    return;
  }
  const ctx = neuralCanvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const inputLinks = Array.from(document.querySelectorAll(".input-link"));
  const brandLink = document.querySelector(".input-brand");
  const pointer = { x: 0, y: 0, active: false };
  let width = 0;
  let height = 0;
  let layers = [];
  let edges = [];
  let animationId = null;
  let palette = readPalette();
  let activeInputIndex = null;
  let waveStart = 0;

  const randomBetween = (min, max) => min + Math.random() * (max - min);

  const quadraticPoint = (a, c, b, t) => {
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    };
  };

  const clamp01 = (value) => Math.min(1, Math.max(0, value));

  const layerGlow = (layerIndex, wavePos) => {
    const dist = Math.abs(layerIndex - wavePos);
    return clamp01(1 - dist);
  };

  const updateInputPositions = () => {
    if (!inputLinks.length || !layers.length) {
      return;
    }
    if (window.innerWidth < 980) {
      inputLinks.forEach((link) => {
        link.style.left = "";
        link.style.top = "";
        link.style.setProperty("--lead", "");
        link.classList.remove("align-node");
      });
      return;
    }
    const inputLayer = layers[0];
    inputLinks.forEach((link, index) => {
      const node = inputLayer[Math.min(index, inputLayer.length - 1)];
      const desiredX = Math.min(width - 120, node.x + 12);
      link.style.left = `${desiredX}px`;
      link.style.top = `${node.y}px`;
      link.style.setProperty("--lead", "0px");
      link.classList.add("align-node");
    });
  };

  const buildNetwork = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    neuralCanvas.width = width * dpr;
    neuralCanvas.height = height * dpr;
    neuralCanvas.style.width = `${width}px`;
    neuralCanvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const layerCount = width < 720 ? 3 : width < 1100 ? 4 : 5;
    const fallbackCount = Math.max(3, Math.min(7, Math.floor(height / 160)));
    const nodeCount = inputLinks.length || fallbackCount;
    const marginX = Math.max(80, width * 0.1);
    const marginY = Math.max(90, height * 0.15);
    const spanX = width - marginX * 2;
    const spanY = height - marginY * 2;

    layers = Array.from({ length: layerCount }, (_, layerIndex) => {
      const xBase = layerCount === 1 ? width / 2 : marginX + (spanX * layerIndex) / (layerCount - 1);
      return Array.from({ length: nodeCount }, (_, nodeIndex) => {
        const t = nodeCount === 1 ? 0.5 : nodeIndex / (nodeCount - 1);
        return {
          x: xBase + randomBetween(-18, 18),
          y: marginY + t * spanY + randomBetween(-22, 22),
          r: 2.2 + Math.random() * 1.8,
          phase: Math.random() * Math.PI * 2,
          layer: layerIndex,
          index: nodeIndex,
        };
      });
    });

    edges = [];
    for (let l = 0; l < layers.length - 1; l += 1) {
      const current = layers[l];
      const next = layers[l + 1];
      current.forEach((node) => {
        const connectionCount = Math.max(1, Math.min(3, Math.floor(next.length * 0.45)));
        const targets = new Set();
        while (targets.size < connectionCount) {
          targets.add(Math.floor(Math.random() * next.length));
        }
        targets.forEach((targetIndex) => {
          edges.push({
            from: node,
            to: next[targetIndex],
            curve: randomBetween(-0.5, 0.5),
            phase: Math.random(),
            speed: randomBetween(0.0002, 0.00045),
            weight: randomBetween(0.2, 1),
          });
        });
      });
    }

    updateInputPositions();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        updateInputPositions();
      });
    }
  };

  const setActiveInput = (index) => {
    if (activeInputIndex === index) {
      activeInputIndex = null;
      waveStart = 0;
    } else {
      activeInputIndex = index;
      waveStart = performance.now();
    }
    inputLinks.forEach((link, linkIndex) => {
      link.classList.toggle("is-active", linkIndex === activeInputIndex);
    });
  };

  const drawFrame = (time) => {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const baseColor = mix(palette.accent2, palette.accent, 0.5);

    const waveEnabled = activeInputIndex !== null && layers.length > 0;
    const waveSpeed = 0.0012;
    const wavePos = waveEnabled ? ((time - waveStart) * waveSpeed) % layers.length : 0;

    edges.forEach((edge) => {
      const dx = edge.to.x - edge.from.x;
      const dy = edge.to.y - edge.from.y;
      const length = Math.hypot(dx, dy) || 1;
      const midX = (edge.from.x + edge.to.x) / 2;
      const midY = (edge.from.y + edge.to.y) / 2;
      const normX = -dy / length;
      const normY = dx / length;
      const curveAmount = edge.curve * Math.min(120, length * 0.5);
      const control = {
        x: midX + normX * curveAmount,
        y: midY + normY * curveAmount,
      };

      const edgeGlow = waveEnabled
        ? Math.max(layerGlow(edge.from.layer, wavePos), layerGlow(edge.to.layer, wavePos))
        : 0;
      const edgeAlpha = 0.06 + edge.weight * 0.12 + edgeGlow * 0.28;
      ctx.strokeStyle = rgba(baseColor, edgeAlpha);
      ctx.lineWidth = 0.7 + edge.weight * 0.9 + edgeGlow * 1.2;
      ctx.beginPath();
      ctx.moveTo(edge.from.x, edge.from.y);
      ctx.quadraticCurveTo(control.x, control.y, edge.to.x, edge.to.y);
      ctx.stroke();

      const t = (time * edge.speed + edge.phase) % 1;
      const point = quadraticPoint(edge.from, control, edge.to, t);
      const glowColor = mix(palette.accent, palette.accent2, t);
      const glowAlpha = 0.28 + edge.weight * 0.2 + edgeGlow * 0.25;
      ctx.fillStyle = rgba(glowColor, glowAlpha);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.6 + edge.weight * 1.4, 0, Math.PI * 2);
      ctx.fill();
    });

    layers.forEach((layer, layerIndex) => {
      const focusIndex = Math.floor(((time * 0.00035 + layerIndex * 0.2) % 1) * layer.length);
      const waveIntensity = waveEnabled ? layerGlow(layerIndex, wavePos) : 0;
      layer.forEach((node, index) => {
        const pulse = 0.6 + 0.4 * Math.sin(time * 0.002 + node.phase);
        let highlight = 0;
        if (pointer.active) {
          const dx = node.x - pointer.x;
          const dy = node.y - pointer.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          highlight = Math.max(0, 1 - dist / 200) * (waveEnabled ? 0.4 : 1);
        }

        const isFocus = !waveEnabled && index === focusIndex;
        const radius = node.r + pulse * 1.2 + highlight * 2.2 + (isFocus ? 1.2 : 0) + waveIntensity * 2.6;
        const coreColor = waveIntensity > 0
          ? mix(palette.accent2, palette.accent, waveIntensity)
          : isFocus
            ? palette.accent
            : mix(palette.accent2, palette.accent, highlight);
        const alpha = 0.28 + highlight * 0.4 + (isFocus ? 0.2 : 0) + waveIntensity * 0.55;
        ctx.fillStyle = rgba(coreColor, alpha);
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (highlight > 0.05 || isFocus || waveIntensity > 0.15) {
          const strokeAlpha = waveIntensity > 0.15 ? 0.85 : isFocus ? 0.55 : highlight * 0.5;
          ctx.strokeStyle = rgba(palette.accent, strokeAlpha);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    });

    ctx.restore();
    if (!prefersReducedMotion) {
      animationId = requestAnimationFrame(drawFrame);
    }
  };

  const start = () => {
    palette = readPalette();
    buildNetwork();
    if (prefersReducedMotion) {
      drawFrame(0);
      return;
    }
    animationId = requestAnimationFrame(drawFrame);
  };

  const stop = () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };

  window.addEventListener("resize", buildNetwork);
  window.addEventListener("mousemove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  });
  window.addEventListener("mouseleave", () => {
    pointer.active = false;
  });
  window.addEventListener(
    "touchmove",
    (event) => {
      const touch = event.touches[0];
      if (touch) {
        pointer.x = touch.clientX;
        pointer.y = touch.clientY;
        pointer.active = true;
      }
    },
    { passive: true }
  );
  window.addEventListener("touchend", () => {
    pointer.active = false;
  });
  if (brandLink) {
    brandLink.addEventListener("click", (event) => {
      event.preventDefault();
      sessionStorage.setItem("forceTop", "1");
      window.location.reload();
    });
  }
  inputLinks.forEach((link, index) => {
    link.addEventListener("click", () => {
      setActiveInput(index);
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  start();
};

const initReveal = () => {
  const revealItems = document.querySelectorAll("[data-reveal]");
  if (!revealItems.length) {
    return;
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }
};

initMatrix();
initNeural();
initReveal();
