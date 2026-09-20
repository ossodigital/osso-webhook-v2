(() => {
  "use strict";

  const FORMATS = {
    story: { w: 1080, h: 1920 },
    feed: { w: 1080, h: 1350 },
    square: { w: 1080, h: 1080 },
  };
  const VIDEO_W = 1080, VIDEO_H = 1920;
  const ZOOM_RANGES = { forte: 0.28, medio: 0.15, leve: 0.08 };
  const STORAGE_KEY = "carouselBuilderProject_v2";

  const DEFAULT_AUDIO_TEXT =
    "Sugestões de áudio (escolha dentro do Instagram a versão oficial ou marcada como tendência):\n\n" +
    "1. [Principal] Áudio cinematográfico/dark em alta no momento — combina com o zoom progressivo e a entrada das palavras.\n" +
    "2. Trilha autoral instrumental de tensão crescente (baixo grave + percussão sutil).\n" +
    "3. Áudio ambiente lo-fi/dark de batida lenta — bom para composições mais autorais (Direção B).\n\n" +
    "Volume recomendado: 60% a 70% quando não houver fala.";

  const HEADLINE_BANK = {
    realismo: [["ARTE", "QUE IMPÕE", "RESPEITO.", "REALISMO", "BLACK AND GREY", "FECHAMENTO"]],
    "black-grey": [["ARTE", "QUE IMPÕE", "RESPEITO.", "BLACK AND GREY", "REALISMO", "FECHAMENTO"]],
    floral: [["DELICADEZA", "SEM PEDIR", "LICENÇA.", "FLORAL", "TRAÇO LIVRE", "AUTORAL"]],
    cobertura: [["NÃO É DISFARCE", "É UMA NOVA", "HISTÓRIA.", "COBERTURA", "REALISMO", "FECHAMENTO"]],
    fechamento: [["TRAÇO LIVRE", "PRESENÇA", "ABSOLUTA.", "FECHAMENTO", "BLACK AND GREY", "AUTORAL"]],
    autoral: [["TRAÇO LIVRE", "PRESENÇA", "ABSOLUTA.", "AUTORAL", "TRAÇO LIVRE", "EXCLUSIVO"]],
    colorido: [["CORES", "QUE CONTAM", "HISTÓRIA.", "COLORIDO", "REALISMO", "AUTORAL"]],
  };
  const HEADLINE_FALLBACK = Object.values(HEADLINE_BANK).flat();

  const HASHTAG_BANK = {
    realismo: ["#tatuagemrealista", "#realismo"],
    "black-grey": ["#blackandgrey", "#blackwork"],
    floral: ["#tattoofloral", "#fineline"],
    cobertura: ["#coberturadetatuagem", "#coverup"],
    fechamento: ["#fechamentodebraço", "#sleevetattoo"],
    autoral: ["#tattoautoral", "#tattooart"],
    colorido: ["#tattoocolorida", "#colortattoo"],
  };
  const BASE_HASHTAGS = ["#tattoo", "#tatuagem", "#vilaprudente", "#saopaulo", "#tattooateosossos"];

  const uid = () => Math.random().toString(36).slice(2, 10);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const slugify = (s) =>
    (s || "peca")
      .toString()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "peca";

  function easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function dataUrlToBlob(dataUrl) {
    const [meta, base64] = dataUrl.split(",");
    const mime = meta.match(/:(.*?);/)[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function hexAlpha(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${a})`;
  }

  function defaultSlide() {
    return {
      id: uid(),
      direction: "A",
      workType: "inferir",
      workTypeCustom: "",
      objective: "orcamento",
      zoomIntensity: "forte",
      specialInfo: "",
      extraText: "",
      media: { dataUrl: null, kind: null, zoom: 110, offsetX: 0, offsetY: 0, filter: "none" },
      vignette: 40,
      bgColor: "#020c08",
      accentColor: "#38f49b",
      textColor: "#f4fff9",
      textSecondaryColor: "#7fa596",
      logoDataUrl: null,
      logoScale: 100,
      logoOffsetX: 0,
      logoOffsetY: 0,
      logoFrame: true,
      fontFamily: "'Bebas Neue', Impact, 'Arial Narrow', sans-serif",
      headline: ["ARTE", "QUE IMPÕE", "RESPEITO."],
      styleWords: ["SAMURAI", "REALISMO", "COBERTURA"],
      brandName: "TATTOO ATÉ OS OSSOS",
      cta: "QUERO MEU ORÇAMENTO",
      ctaCustom: "",
      phone: "(11) 92635-5407",
      command: "Digite: ORÇAMENTO",
      location: "Vila Prudente • São Paulo",
      notice: "Atendimento somente para maiores de 18 anos",
      badgeOn: true,
      caption: "",
      hashtags: "",
      audio: DEFAULT_AUDIO_TEXT,
    };
  }

  let state = {
    format: "feed",
    currentIndex: 0,
    customFontDataUrl: null,
    slides: [defaultSlide()],
  };

  const mediaImages = new Map();
  const logoImages = new Map();
  const thumbCache = new Map();

  function cur() {
    return state.slides[state.currentIndex];
  }

  // ---------- image helpers ----------
  function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  function resizeImageFile(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          const scale = Math.min(1, maxDim / Math.max(width, height));
          width = Math.round(width * scale);
          height = Math.round(height * scale);
          const c = document.createElement("canvas");
          c.width = width; c.height = height;
          c.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(c.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function setSlideMediaFromDataUrl(slide, dataUrl) {
    slide.media.dataUrl = dataUrl;
    slide.media.kind = "image";
    const img = await loadImageFromDataUrl(dataUrl);
    if (img) mediaImages.set(slide.id, img);
    render();
    refreshCurrentThumbnail();
    scheduleAutosave();
  }

  async function setSlideLogoFromDataUrl(slide, dataUrl) {
    slide.logoDataUrl = dataUrl;
    const img = await loadImageFromDataUrl(dataUrl);
    if (img) logoImages.set(slide.id, img);
    render();
    refreshCurrentThumbnail();
    scheduleAutosave();
  }

  async function registerCustomFont(dataUrl) {
    try {
      const buf = await (await fetch(dataUrl)).arrayBuffer();
      const font = new FontFace("CarouselCustomFont", buf);
      await font.load();
      document.fonts.add(font);
    } catch (e) {
      console.warn("Falha ao carregar fonte personalizada", e);
    }
  }

  // ---------- drawing primitives ----------
  function drawCornerFrame(ctx, x, y, w, h, color, len = 34, lw = 2) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ].forEach(([cx, cy, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + len * dy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + len * dx, cy);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawCheckBadge(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.45, cy);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.4);
    ctx.lineTo(cx + r * 0.5, cy - r * 0.35);
    ctx.stroke();
    ctx.restore();
  }

  function wrapWords(ctx, text, maxWidth, font) {
    ctx.font = font;
    const words = (text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function fitHeadlineFontSize(ctx, lines, maxWidth, maxTotalHeight, fontFamily, baseSize = 108, minSize = 40) {
    for (let size = baseSize; size >= minSize; size -= 2) {
      ctx.font = `900 ${size}px ${fontFamily}`;
      const widest = Math.max(...lines.map((l) => ctx.measureText(l.toUpperCase()).width));
      const totalH = size * 1.08 * lines.length;
      if (widest <= maxWidth && totalH <= maxTotalHeight) return size;
    }
    return minSize;
  }

  function drawMediaCover(ctx, img, rect, zoom, ox, oy, filter, accentColor) {
    const { x, y, w, h } = rect;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (img) {
      const scale = Math.max(w / img.width, h / img.height) * zoom;
      const dw = img.width * scale, dh = img.height * scale;
      const baseX = x + (w - dw) / 2, baseY = y + (h - dh) / 2;
      const shiftX = (ox / 100) * Math.max(0, (dw - w) / 2);
      const shiftY = (oy / 100) * Math.max(0, (dh - h) / 2);
      ctx.filter =
        filter === "grayscale" ? "grayscale(100%) contrast(112%) brightness(98%)" :
        filter === "duotone" ? "grayscale(100%) contrast(120%)" : "none";
      ctx.drawImage(img, baseX - shiftX, baseY - shiftY, dw, dh);
      ctx.filter = "none";
      if (filter === "duotone") {
        ctx.globalCompositeOperation = "color";
        ctx.fillStyle = accentColor;
        ctx.fillRect(x, y, w, h);
        ctx.globalCompositeOperation = "source-over";
      }
    } else {
      ctx.fillStyle = "#111417";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#4b5559";
      ctx.font = "26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Envie uma foto ou vídeo", x + w / 2, y + h / 2);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  function applyVignette(ctx, rect, intensity, fullBleed) {
    const { x, y, w, h } = rect;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const grad = ctx.createRadialGradient(
      x + w * 0.5, y + h * 0.45, Math.min(w, h) * 0.15,
      x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.75
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${(intensity / 100) * 0.8})`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    if (fullBleed) {
      const g2 = ctx.createLinearGradient(0, y + h * 0.3, 0, y + h);
      g2.addColorStop(0, "rgba(2,12,8,0)");
      g2.addColorStop(1, "rgba(2,12,8,0.93)");
      ctx.fillStyle = g2;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  // ---------- entrance animation ----------
  const ENTRANCE_DIRS = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
  function entranceParams(t, start, end, dirName, magnitude = 150, rotDeg = 5) {
    if (t == null) return { dx: 0, dy: 0, rot: 0, alpha: 1 };
    const [vx, vy] = ENTRANCE_DIRS[dirName];
    if (t <= start) return { dx: vx * magnitude, dy: vy * magnitude, rot: (rotDeg * Math.PI) / 180, alpha: 0 };
    const p = clamp((t - start) / (end - start), 0, 1);
    const eased = easeOutBack(p);
    return {
      dx: vx * magnitude * (1 - eased),
      dy: vy * magnitude * (1 - eased),
      rot: ((rotDeg * Math.PI) / 180) * (1 - eased),
      alpha: clamp(p * 4, 0, 1),
    };
  }

  function withEntrance(ctx, centerX, centerY, params, drawFn) {
    ctx.save();
    ctx.globalAlpha = params.alpha;
    ctx.translate(centerX + params.dx, centerY + params.dy);
    ctx.rotate(params.rot);
    ctx.translate(-centerX, -centerY);
    drawFn();
    ctx.restore();
  }

  function getZoomOffset(slide, t) {
    const baseZoom = slide.media.zoom / 100;
    const baseOX = slide.media.offsetX;
    const baseOY = slide.media.offsetY;
    if (t == null) return { zoom: baseZoom, ox: baseOX, oy: baseOY };
    const growth = ZOOM_RANGES[slide.zoomIntensity] ?? ZOOM_RANGES.forte;
    return {
      zoom: baseZoom * (1 + growth * (t / 8)),
      ox: baseOX - (t / 8) * 10,
      oy: baseOY - (t / 8) * 4,
    };
  }

  // ---------- header / commercial block ----------
  function drawHeader(ctx, slide, x, y, maxWidth) {
    const logoSize = 92 * ((slide.logoScale ?? 100) / 100);
    const logoX = x + (slide.logoOffsetX ?? 0);
    const logoY = y + (slide.logoOffsetY ?? 0);
    const logoImg = logoImages.get(slide.id);
    let textX = x;
    if (logoImg || slide.logoDataUrl) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(logoX, logoY, logoSize, logoSize);
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(logoX, logoY, logoSize, logoSize);
      if (logoImg) {
        const s = Math.min(logoSize / logoImg.width, logoSize / logoImg.height) * 0.86;
        const dw = logoImg.width * s, dh = logoImg.height * s;
        ctx.drawImage(logoImg, logoX + (logoSize - dw) / 2, logoY + (logoSize - dh) / 2, dw, dh);
      }
      ctx.restore();
      if (slide.logoFrame ?? true) drawCornerFrame(ctx, logoX, logoY, logoSize, logoSize, slide.accentColor, 18, 2);
      textX = Math.max(x, logoX + logoSize + 20);
    }
    const brand = (slide.brandName || "").toUpperCase();
    ctx.fillStyle = slide.accentColor;
    ctx.fillRect(textX, y + 8, 26, 3);
    ctx.fillStyle = slide.textColor;
    ctx.font = "700 24px " + slide.fontFamily;
    ctx.textAlign = "left";
    const brandLines = wrapWords(ctx, brand, Math.max(80, maxWidth - (textX - x)), "700 24px " + slide.fontFamily);
    brandLines.slice(0, 2).forEach((l, i) => ctx.fillText(l, textX, y + 40 + i * 28));
  }

  function ctaLabel(slide) {
    return slide.cta === "custom" ? slide.ctaCustom || "QUERO MEU ORÇAMENTO" : slide.cta;
  }

  function drawCtaButton(ctx, slide, x, y, w, h) {
    ctx.save();
    const r = 14;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = slide.accentColor;
    ctx.fill();
    ctx.fillStyle = "#04140d";
    ctx.font = "900 " + Math.round(h * 0.36) + "px " + slide.fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ctaLabel(slide).toUpperCase(), x + w / 2, y + h / 2 + 2);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawPhoneRow(ctx, slide, x, y, w) {
    ctx.fillStyle = slide.textColor;
    ctx.font = "800 46px " + slide.fontFamily;
    ctx.textAlign = "left";
    ctx.fillText(slide.phone, x, y);
    const cmd = slide.command || "";
    const idx = cmd.lastIndexOf(" ");
    const prefix = idx >= 0 ? cmd.slice(0, idx + 1) : cmd;
    const last = idx >= 0 ? cmd.slice(idx + 1) : "";
    ctx.font = "700 26px " + slide.fontFamily;
    ctx.fillStyle = slide.textSecondaryColor;
    const prefixW = ctx.measureText(prefix).width;
    ctx.fillText(prefix, x, y + 36);
    ctx.fillStyle = slide.accentColor;
    ctx.fillText(last, x + prefixW, y + 36);
  }

  function drawFooter(ctx, slide, x, y, w) {
    let cursorX = x;
    if (slide.badgeOn) {
      drawCheckBadge(ctx, x + 14, y - 6, 15, slide.accentColor);
      cursorX = x + 40;
    }
    ctx.font = "600 22px " + slide.fontFamily;
    ctx.fillStyle = slide.textSecondaryColor;
    ctx.textAlign = "left";
    const lines = wrapWords(ctx, slide.notice, w - (cursorX - x), "600 22px " + slide.fontFamily);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, cursorX, y + i * 26));
  }

  // ---------- main frame renderer ----------
  function renderFrame(ctx, slide, W, H, t) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = slide.bgColor;
    ctx.fillRect(0, 0, W, H);

    const dir = slide.direction;
    const fullBleed = dir === "C";
    const pad = dir === "B" ? 84 : 64;

    let imageRect, textRect;
    if (fullBleed) {
      imageRect = { x: 0, y: 0, w: W, h: H };
      textRect = { x: pad, y: pad, w: W - 2 * pad, h: H - 2 * pad };
    } else {
      const panelW = Math.round(W * 0.5);
      imageRect = { x: panelW, y: 0, w: W - panelW, h: H };
      textRect = { x: pad, y: pad, w: panelW - 2 * pad, h: H - 2 * pad };
    }

    const img = mediaImages.get(slide.id);
    const { zoom, ox, oy } = getZoomOffset(slide, t);
    drawMediaCover(ctx, img, imageRect, zoom, ox, oy, slide.media.filter, slide.accentColor);
    applyVignette(ctx, imageRect, slide.vignette, fullBleed);
    drawCornerFrame(
      ctx, imageRect.x + 18, imageRect.y + 18, imageRect.w - 36, imageRect.h - 36,
      hexAlpha(slide.accentColor, 0.85)
    );

    // header
    let p = entranceParams(t, 0.1, 0.9, "top");
    withEntrance(ctx, textRect.x + 46, textRect.y + 46, p, () => {
      drawHeader(ctx, slide, textRect.x, textRect.y, textRect.w);
    });

    // bottom-anchored commercial stack
    const showStyleLine = dir !== "C";
    const gapS = 14, gapM = 26;
    let cy = textRect.y + textRect.h;

    const footerH = slide.badgeOn || slide.notice ? 54 : 0;
    cy -= footerH;
    const footerY = cy + 20;
    cy -= gapS;

    cy -= 34;
    const locationY = cy + 24;
    cy -= gapS;

    cy -= 78;
    const phoneY = cy + 46;
    cy -= gapM;

    const ctaH = 90;
    cy -= ctaH;
    const ctaY = cy;
    cy -= gapM;

    let styleLineY = null;
    if (showStyleLine) {
      cy -= 36;
      styleLineY = cy + 26;
      cy -= gapS;
    }

    const headlineBottom = cy - gapM;
    const headlineTopMin = textRect.y + 150;
    const headlineMaxH = Math.max(120, headlineBottom - headlineTopMin);
    const lines = [slide.headline[0] || "", slide.headline[1] || "", slide.headline[2] || ""];
    const baseSize = dir === "B" ? 90 : dir === "C" ? 80 : 100;
    const fontSize = fitHeadlineFontSize(ctx, lines, textRect.w, headlineMaxH, slide.fontFamily, baseSize);
    const lineH = fontSize * 1.08;
    const headlineTop = headlineBottom - lineH * lines.length;

    const headlineDirs = ["left", "right", "left"];
    const headlineWindows = [
      [0.3, 1.3], [0.6, 1.6], [0.9, 1.9],
    ];
    lines.forEach((line, i) => {
      if (!line) return;
      const yPos = headlineTop + lineH * (i + 1) - lineH * 0.18;
      const pp = entranceParams(t, headlineWindows[i][0], headlineWindows[i][1], headlineDirs[i]);
      withEntrance(ctx, textRect.x + textRect.w / 2, yPos, pp, () => {
        ctx.font = `900 ${fontSize}px ${slide.fontFamily}`;
        ctx.textAlign = "left";
        ctx.fillStyle = i === 2 ? slide.accentColor : slide.textColor;
        ctx.fillText(line.toUpperCase(), textRect.x, yPos);
      });
    });

    if (showStyleLine) {
      const styleText = slide.styleWords.filter(Boolean).join("  •  ").toUpperCase();
      const pp = entranceParams(t, 1.3, 2.2, "right");
      withEntrance(ctx, textRect.x + textRect.w / 2, styleLineY, pp, () => {
        ctx.font = "700 26px " + slide.fontFamily;
        ctx.fillStyle = slide.textSecondaryColor;
        ctx.textAlign = "left";
        ctx.fillText(styleText, textRect.x, styleLineY);
      });
    }

    const pCta = entranceParams(t, 1.9, 2.9, "bottom");
    withEntrance(ctx, textRect.x + textRect.w / 2, ctaY + ctaH / 2, pCta, () => {
      drawCtaButton(ctx, slide, textRect.x, ctaY, textRect.w, ctaH);
    });

    const pPhone = entranceParams(t, 2.3, 3.4, "left");
    withEntrance(ctx, textRect.x + textRect.w / 2, phoneY, pPhone, () => {
      drawPhoneRow(ctx, slide, textRect.x, phoneY, textRect.w);
    });

    const pLoc = entranceParams(t, 2.3, 3.4, "right");
    withEntrance(ctx, textRect.x + textRect.w / 2, locationY, pLoc, () => {
      ctx.font = "600 26px " + slide.fontFamily;
      ctx.fillStyle = slide.textSecondaryColor;
      ctx.textAlign = "left";
      ctx.fillText((slide.location || "").toUpperCase(), textRect.x, locationY);
    });

    const pFooter = entranceParams(t, 2.3, 3.4, "bottom", 60, 0);
    withEntrance(ctx, textRect.x + textRect.w / 2, footerY, pFooter, () => {
      drawFooter(ctx, slide, textRect.x, footerY, textRect.w);
    });

    if (slide.specialInfo) {
      ctx.save();
      ctx.font = "700 20px " + slide.fontFamily;
      const label = slide.specialInfo.toUpperCase();
      const tw = ctx.measureText(label).width;
      const bx = W - pad - tw - 28, by = pad - 6, bw = tw + 28, bh = 38;
      ctx.strokeStyle = slide.accentColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = slide.textColor;
      ctx.textAlign = "left";
      ctx.fillText(label, bx + 14, by + 25);
      ctx.restore();
    }

    if (slide.extraText) {
      ctx.font = "500 20px " + slide.fontFamily;
      ctx.fillStyle = slide.textSecondaryColor;
      ctx.textAlign = "left";
      ctx.fillText(slide.extraText, textRect.x, footerY + footerH + 8);
    }
  }

  function render() {
    const canvas = document.getElementById("previewCanvas");
    const fmt = FORMATS[state.format];
    canvas.width = fmt.w;
    canvas.height = fmt.h;
    renderFrame(canvas.getContext("2d"), cur(), fmt.w, fmt.h, null);
  }

  // ---------- thumbnails ----------
  function renderThumbnail(slide) {
    const fmt = FORMATS[state.format];
    const off = document.createElement("canvas");
    const scale = 120 / fmt.w;
    off.width = 120;
    off.height = Math.round(fmt.h * scale);
    const octx = off.getContext("2d");
    octx.scale(scale, scale);
    renderFrame(octx, slide, fmt.w, fmt.h, null);
    return off.toDataURL("image/jpeg", 0.72);
  }

  function refreshCurrentThumbnail() {
    thumbCache.set(cur().id, renderThumbnail(cur()));
    renderSlidesStrip();
  }

  function renderSlidesStrip() {
    const strip = document.getElementById("slidesStrip");
    strip.innerHTML = "";
    state.slides.forEach((s, i) => {
      if (!thumbCache.has(s.id)) thumbCache.set(s.id, renderThumbnail(s));
      const div = document.createElement("div");
      div.className = "slide-thumb" + (i === state.currentIndex ? " active" : "");
      div.style.backgroundImage = `url(${thumbCache.get(s.id)})`;
      div.innerHTML = `<span class="idx">${i + 1}</span>`;
      div.addEventListener("click", () => {
        state.currentIndex = i;
        loadSlideIntoForm(cur());
        render();
        renderSlidesStrip();
      });
      strip.appendChild(div);
    });
  }

  // ---------- form binding ----------
  const $ = (id) => document.getElementById(id);

  function loadSlideIntoForm(s) {
    $("formatSelect").value = state.format;
    document.querySelectorAll("#directionOptions .layout-option").forEach((b) => {
      b.classList.toggle("active", b.dataset.direction === s.direction);
    });
    $("workTypeSelect").value = s.workType;
    $("workTypeCustom").value = s.workTypeCustom;
    $("workTypeCustom").classList.toggle("hidden", s.workType !== "outro");
    $("objectiveSelect").value = s.objective;
    $("zoomIntensitySelect").value = s.zoomIntensity;
    $("specialInfoInput").value = s.specialInfo;
    $("extraTextInput").value = s.extraText;

    $("mediaZoom").value = s.media.zoom;
    $("mediaFilter").value = s.media.filter;
    $("mediaOffsetX").value = s.media.offsetX;
    $("mediaOffsetY").value = s.media.offsetY;
    $("vignetteIntensity").value = s.vignette;
    $("videoFrameControls").classList.add("hidden");

    $("bgColor").value = s.bgColor;
    $("accentColor").value = s.accentColor;
    $("textColor").value = s.textColor;
    $("textSecondaryColor").value = s.textSecondaryColor;
    $("logoScale").value = s.logoScale ?? 100;
    $("logoOffsetX").value = s.logoOffsetX ?? 0;
    $("logoOffsetY").value = s.logoOffsetY ?? 0;
    $("logoFrame").checked = s.logoFrame ?? true;
    if (s.fontFamily === "'CarouselCustomFont', sans-serif") {
      $("fontSelect").value = "custom";
      $("customFontStatus").textContent = state.customFontName
        ? `Fonte personalizada carregada: ${state.customFontName}`
        : "Fonte personalizada carregada.";
    } else {
      $("fontSelect").value = s.fontFamily;
      $("customFontStatus").textContent = "";
    }

    $("headlineLine1").value = s.headline[0] || "";
    $("headlineLine2").value = s.headline[1] || "";
    $("headlineLine3").value = s.headline[2] || "";
    $("styleWord1").value = s.styleWords[0] || "";
    $("styleWord2").value = s.styleWords[1] || "";
    $("styleWord3").value = s.styleWords[2] || "";

    $("brandName").value = s.brandName;
    const knownCta = ["QUERO MEU ORÇAMENTO", "QUERO MEU PROJETO"];
    $("ctaSelect").value = knownCta.includes(s.cta) ? s.cta : "custom";
    $("ctaCustom").classList.toggle("hidden", knownCta.includes(s.cta));
    $("ctaCustom").value = knownCta.includes(s.cta) ? s.ctaCustom : s.cta;
    $("phoneText").value = s.phone;
    $("commandText").value = s.command;
    $("locationText").value = s.location;
    $("noticeText").value = s.notice;
    $("badgeToggle").checked = s.badgeOn;

    $("captionTextarea").value = s.caption;
    $("hashtagsInput").value = s.hashtags;
    $("audioTextarea").value = s.audio || DEFAULT_AUDIO_TEXT;
  }

  function commit() {
    render();
    refreshCurrentThumbnail();
    scheduleAutosave();
  }

  let autosaveTimer = null;
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.warn("Autosave falhou (provavelmente projeto muito grande para o localStorage):", e);
      }
    }, 500);
  }

  function bindSimple(id, apply, evt = "input") {
    $(id).addEventListener(evt, (e) => {
      apply(cur(), e.target);
      commit();
    });
  }

  function initBindings() {
    $("formatSelect").addEventListener("input", (e) => {
      state.format = e.target.value;
      commit();
    });

    document.querySelectorAll("#directionOptions .layout-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        cur().direction = btn.dataset.direction;
        document.querySelectorAll("#directionOptions .layout-option").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        commit();
      });
    });

    bindSimple("workTypeSelect", (s, el) => {
      s.workType = el.value;
      $("workTypeCustom").classList.toggle("hidden", el.value !== "outro");
    });
    bindSimple("workTypeCustom", (s, el) => (s.workTypeCustom = el.value));
    bindSimple("objectiveSelect", (s, el) => (s.objective = el.value));
    bindSimple("zoomIntensitySelect", (s, el) => (s.zoomIntensity = el.value));
    bindSimple("specialInfoInput", (s, el) => (s.specialInfo = el.value));
    bindSimple("extraTextInput", (s, el) => (s.extraText = el.value));

    bindSimple("mediaZoom", (s, el) => (s.media.zoom = Number(el.value)));
    bindSimple("mediaFilter", (s, el) => (s.media.filter = el.value));
    bindSimple("mediaOffsetX", (s, el) => (s.media.offsetX = Number(el.value)));
    bindSimple("mediaOffsetY", (s, el) => (s.media.offsetY = Number(el.value)));
    bindSimple("vignetteIntensity", (s, el) => (s.vignette = Number(el.value)));

    bindSimple("bgColor", (s, el) => (s.bgColor = el.value));
    bindSimple("accentColor", (s, el) => (s.accentColor = el.value));
    bindSimple("textColor", (s, el) => (s.textColor = el.value));
    bindSimple("textSecondaryColor", (s, el) => (s.textSecondaryColor = el.value));
    bindSimple("logoScale", (s, el) => (s.logoScale = Number(el.value)));
    bindSimple("logoOffsetX", (s, el) => (s.logoOffsetX = Number(el.value)));
    bindSimple("logoOffsetY", (s, el) => (s.logoOffsetY = Number(el.value)));
    bindSimple("logoFrame", (s, el) => (s.logoFrame = el.checked));

    $("fontSelect").addEventListener("change", (e) => {
      if (e.target.value === "custom") {
        $("customFontInput").click();
      } else {
        cur().fontFamily = e.target.value;
        $("customFontStatus").textContent = "";
        commit();
      }
    });
    $("customFontInput").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        state.customFontDataUrl = dataUrl;
        state.customFontName = file.name;
        await registerCustomFont(dataUrl);
        cur().fontFamily = "'CarouselCustomFont', sans-serif";
        $("customFontStatus").textContent = `Fonte personalizada carregada: ${file.name}`;
        commit();
      };
      reader.readAsDataURL(file);
    });

    bindSimple("headlineLine1", (s, el) => (s.headline[0] = el.value));
    bindSimple("headlineLine2", (s, el) => (s.headline[1] = el.value));
    bindSimple("headlineLine3", (s, el) => (s.headline[2] = el.value));
    bindSimple("styleWord1", (s, el) => (s.styleWords[0] = el.value));
    bindSimple("styleWord2", (s, el) => (s.styleWords[1] = el.value));
    bindSimple("styleWord3", (s, el) => (s.styleWords[2] = el.value));

    $("suggestHeadlineBtn").addEventListener("click", () => {
      const bank = HEADLINE_BANK[cur().workType] || HEADLINE_FALLBACK;
      const pick = bank[Math.floor(Math.random() * bank.length)];
      cur().headline = [pick[0], pick[1], pick[2]];
      cur().styleWords = [pick[3], pick[4], pick[5]];
      loadSlideIntoForm(cur());
      commit();
    });

    bindSimple("brandName", (s, el) => (s.brandName = el.value));
    $("ctaSelect").addEventListener("input", (e) => {
      const isCustom = e.target.value === "custom";
      $("ctaCustom").classList.toggle("hidden", !isCustom);
      cur().cta = isCustom ? $("ctaCustom").value || "PERSONALIZADO" : e.target.value;
      commit();
    });
    $("ctaCustom").addEventListener("input", (e) => {
      cur().cta = e.target.value;
      commit();
    });
    bindSimple("phoneText", (s, el) => (s.phone = el.value));
    bindSimple("commandText", (s, el) => (s.command = el.value));
    bindSimple("locationText", (s, el) => (s.location = el.value));
    bindSimple("noticeText", (s, el) => (s.notice = el.value));
    bindSimple("badgeToggle", (s, el) => (s.badgeOn = el.checked));

    bindSimple("captionTextarea", (s, el) => (s.caption = el.value));
    bindSimple("hashtagsInput", (s, el) => (s.hashtags = el.value));
    bindSimple("audioTextarea", (s, el) => (s.audio = el.value));

    $("generateCaptionBtn").addEventListener("click", () => {
      const s = cur();
      const headline = s.headline.filter(Boolean).join(" ");
      const objMap = {
        portfolio: "Mais um trabalho autoral saindo do estúdio.",
        orcamento: "Vagas abertas para novos projetos personalizados.",
        autoridade: "Cada peça reforça o padrão de qualidade da casa.",
        agenda: "Agenda com horários disponíveis nesta semana.",
        "projeto-exclusivo": "Projeto exclusivo, pensado ponto a ponto para quem tatuou.",
      };
      const workLabel = s.workType === "outro" ? s.workTypeCustom : s.styleWords[0] || s.workType;
      const caption = [
        headline,
        `${workLabel ? workLabel.toUpperCase() + ". " : ""}${objMap[s.objective] || ""}`.trim(),
        "Qual detalhe mais chamou sua atenção nesse trabalho?",
        `Quer um projeto assim? Chama no WhatsApp e digite ORÇAMENTO: ${s.phone}`,
        `${s.location}`,
        s.notice,
      ].filter(Boolean).join("\n\n");
      $("captionTextarea").value = caption;
      cur().caption = caption;
      if (!$("hashtagsInput").value) {
        const extra = HASHTAG_BANK[s.workType] || [];
        const tags = [...new Set([...extra, ...BASE_HASHTAGS])].slice(0, 7).join(" ");
        $("hashtagsInput").value = tags;
        cur().hashtags = tags;
      }
      scheduleAutosave();
    });

    $("copyCaptionBtn").addEventListener("click", async () => {
      const text = $("captionTextarea").value + "\n\n" + $("hashtagsInput").value;
      try {
        await navigator.clipboard.writeText(text);
        alert("Legenda copiada!");
      } catch (e) {
        alert("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
      }
    });

    // media upload
    let activeVideoEl = null;
    $("mediaInput").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.type.startsWith("video/")) {
        setupVideoCapture(file);
      } else {
        $("videoFrameControls").classList.add("hidden");
        const dataUrl = await resizeImageFile(file, 2000, 0.9);
        await setSlideMediaFromDataUrl(cur(), dataUrl);
      }
    });

    function setupVideoCapture(file) {
      if (activeVideoEl) activeVideoEl.remove();
      activeVideoEl = document.createElement("video");
      activeVideoEl.muted = true;
      activeVideoEl.playsInline = true;
      activeVideoEl.style.width = "100%";
      activeVideoEl.style.borderRadius = "6px";
      activeVideoEl.style.marginTop = "6px";
      $("videoFrameControls").appendChild(activeVideoEl);
      activeVideoEl.src = URL.createObjectURL(file);
      activeVideoEl.addEventListener("loadedmetadata", () => {
        $("videoScrub").max = activeVideoEl.duration || 1;
        $("videoScrub").value = Math.min(0.15, (activeVideoEl.duration || 1) / 2);
        activeVideoEl.currentTime = Number($("videoScrub").value);
        $("videoFrameControls").classList.remove("hidden");
      });
    }

    $("videoScrub").addEventListener("input", (e) => {
      if (activeVideoEl) activeVideoEl.currentTime = Number(e.target.value);
    });

    $("captureFrameBtn").addEventListener("click", async () => {
      if (!activeVideoEl) return;
      const c = document.createElement("canvas");
      c.width = activeVideoEl.videoWidth;
      c.height = activeVideoEl.videoHeight;
      c.getContext("2d").drawImage(activeVideoEl, 0, 0);
      const maxDim = 2000;
      const scale = Math.min(1, maxDim / Math.max(c.width, c.height));
      let dataUrl;
      if (scale < 1) {
        const c2 = document.createElement("canvas");
        c2.width = c.width * scale; c2.height = c.height * scale;
        c2.getContext("2d").drawImage(c, 0, 0, c2.width, c2.height);
        dataUrl = c2.toDataURL("image/jpeg", 0.9);
      } else {
        dataUrl = c.toDataURL("image/jpeg", 0.9);
      }
      await setSlideMediaFromDataUrl(cur(), dataUrl);
    });

    $("logoInput").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await resizeImageFile(file, 600, 0.92);
      await setSlideLogoFromDataUrl(cur(), dataUrl);
    });

    // slide management
    $("addSlideBtn").addEventListener("click", () => {
      const original = cur();
      const clone = JSON.parse(JSON.stringify(original));
      clone.id = uid();
      if (mediaImages.has(original.id)) mediaImages.set(clone.id, mediaImages.get(original.id));
      if (logoImages.has(original.id)) logoImages.set(clone.id, logoImages.get(original.id));
      state.slides.splice(state.currentIndex + 1, 0, clone);
      state.currentIndex++;
      finishSlideMutation();
    });
    $("duplicateSlideBtn").addEventListener("click", () => $("addSlideBtn").click());
    $("deleteSlideBtn").addEventListener("click", () => {
      if (state.slides.length <= 1) return;
      const [removed] = state.slides.splice(state.currentIndex, 1);
      thumbCache.delete(removed.id);
      mediaImages.delete(removed.id);
      logoImages.delete(removed.id);
      state.currentIndex = clamp(state.currentIndex, 0, state.slides.length - 1);
      finishSlideMutation();
    });
    $("moveLeftBtn").addEventListener("click", () => {
      if (state.currentIndex === 0) return;
      const arr = state.slides;
      [arr[state.currentIndex - 1], arr[state.currentIndex]] = [arr[state.currentIndex], arr[state.currentIndex - 1]];
      state.currentIndex--;
      finishSlideMutation();
    });
    $("moveRightBtn").addEventListener("click", () => {
      if (state.currentIndex === state.slides.length - 1) return;
      const arr = state.slides;
      [arr[state.currentIndex + 1], arr[state.currentIndex]] = [arr[state.currentIndex], arr[state.currentIndex + 1]];
      state.currentIndex++;
      finishSlideMutation();
    });

    function finishSlideMutation() {
      loadSlideIntoForm(cur());
      render();
      renderSlidesStrip();
      scheduleAutosave();
    }

    // export — works both as a local file:// page (classic <a download>) and
    // as a published Artifact, where downloads only leave the sandbox through
    // the `downloads` capability.
    let downloadsCapPromise = null;
    function getDownloadsCapability() {
      if (!window.claude || typeof window.claude.use !== "function") return Promise.resolve(null);
      if (!downloadsCapPromise) downloadsCapPromise = window.claude.use("downloads").catch(() => null);
      return downloadsCapPromise;
    }

    async function triggerDownload(blobOrUrl, filename) {
      const downloads = await getDownloadsCapability();
      if (downloads) {
        const data = typeof blobOrUrl === "string" ? dataUrlToBlob(blobOrUrl) : blobOrUrl;
        try {
          await downloads.save({ filename, data });
        } catch (e) {
          if (e && e.code !== "declined") console.warn("Falha ao salvar arquivo:", e);
        }
        return;
      }
      const a = document.createElement("a");
      a.href = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    $("downloadOneBtn").addEventListener("click", () => {
      const canvas = $("previewCanvas");
      canvas.toBlob((blob) => {
        const s = cur();
        triggerDownload(blob, `${slugify(s.brandName)}_${slugify(s.workType)}_${slugify(s.headline[0])}_capa.png`);
      }, "image/png");
    });

    $("downloadAllBtn").addEventListener("click", async () => {
      const fmt = FORMATS[state.format];
      for (let i = 0; i < state.slides.length; i++) {
        const s = state.slides[i];
        const off = document.createElement("canvas");
        off.width = fmt.w; off.height = fmt.h;
        renderFrame(off.getContext("2d"), s, fmt.w, fmt.h, null);
        const blob = await new Promise((resolve) => off.toBlob(resolve, "image/png"));
        await triggerDownload(blob, `${slugify(s.brandName)}_slide${i + 1}.png`);
      }
    });

    function pickVideoMime() {
      const candidates = [
        "video/mp4;codecs=avc1.42E01E",
        "video/mp4",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      for (const c of candidates) {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
      }
      return "";
    }

    $("generateVideoBtn").addEventListener("click", () => {
      const canvas = $("previewCanvas");
      const prevFormat = state.format;
      canvas.width = VIDEO_W;
      canvas.height = VIDEO_H;
      const ctx = canvas.getContext("2d");
      const mime = pickVideoMime();
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

      $("videoProgressWrap").classList.remove("hidden");
      $("generateVideoBtn").disabled = true;

      let coverDataUrl = null;

      recorder.onstop = async () => {
        const ext = (mime || "video/webm").includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(chunks, { type: mime || "video/webm" });
        const s = cur();
        const filename = `tattoo-ate-os-ossos_${slugify(s.styleWords[0] || s.workType)}_${slugify(s.headline[0])}_reel.${ext}`;

        await triggerDownload(blob, filename);
        if (coverDataUrl) {
          await triggerDownload(dataUrlToBlob(coverDataUrl), filename.replace(/\.(mp4|webm)$/, "_capa.png"));
        }

        $("videoProgressWrap").classList.add("hidden");
        $("generateVideoBtn").disabled = false;
        state.format = prevFormat;
        render();
      };

      recorder.start();
      const duration = 8000;
      const t0 = performance.now();
      function frame(now) {
        const elapsed = now - t0;
        const t = Math.min(elapsed / 1000, 8);
        renderFrame(ctx, cur(), VIDEO_W, VIDEO_H, t);
        const pct = Math.min(100, (elapsed / duration) * 100);
        $("videoProgressFill").style.width = pct + "%";
        if (elapsed < duration) {
          requestAnimationFrame(frame);
        } else {
          coverDataUrl = canvas.toDataURL("image/png");
          recorder.stop();
        }
      }
      requestAnimationFrame(frame);
    });

    // project save/load
    $("saveProjectBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
      triggerDownload(blob, "carrossel-tattoo-projeto.json");
    });

    $("loadProjectInput").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const loaded = JSON.parse(text);
        if (!loaded.slides || !Array.isArray(loaded.slides)) throw new Error("Arquivo inválido");
        state = loaded;
        state.currentIndex = clamp(state.currentIndex || 0, 0, state.slides.length - 1);
        mediaImages.clear();
        logoImages.clear();
        thumbCache.clear();
        if (state.customFontDataUrl) await registerCustomFont(state.customFontDataUrl);
        for (const s of state.slides) {
          if (s.media && s.media.dataUrl) {
            const img = await loadImageFromDataUrl(s.media.dataUrl);
            if (img) mediaImages.set(s.id, img);
          }
          if (s.logoDataUrl) {
            const img = await loadImageFromDataUrl(s.logoDataUrl);
            if (img) logoImages.set(s.id, img);
          }
        }
        loadSlideIntoForm(cur());
        render();
        renderSlidesStrip();
        scheduleAutosave();
      } catch (err) {
        alert("Não foi possível abrir esse projeto: " + err.message);
      }
      e.target.value = "";
    });
  }

  async function restoreAutosave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const loaded = JSON.parse(raw);
      if (!loaded.slides || !loaded.slides.length) return;
      state = loaded;
      state.currentIndex = clamp(state.currentIndex || 0, 0, state.slides.length - 1);
      if (state.customFontDataUrl) await registerCustomFont(state.customFontDataUrl);
      for (const s of state.slides) {
        if (s.media && s.media.dataUrl) {
          const img = await loadImageFromDataUrl(s.media.dataUrl);
          if (img) mediaImages.set(s.id, img);
        }
        if (s.logoDataUrl) {
          const img = await loadImageFromDataUrl(s.logoDataUrl);
          if (img) logoImages.set(s.id, img);
        }
      }
    } catch (e) {
      console.warn("Não foi possível restaurar autosave", e);
    }
  }

  (async function init() {
    await restoreAutosave();
    initBindings();
    loadSlideIntoForm(cur());
    render();
    renderSlidesStrip();
  })();
})();
