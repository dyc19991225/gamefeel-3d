import * as THREE from 'three';
import { AudioForge } from '../core/audioForge';
import { StudioStage } from '../core/stage';
import type { CategoryId, Locale, RecipeDefinition, RecipeInstance, TelemetryFrame } from '../core/types';
import { VfxForge } from '../core/vfxForge';
import { ALL_RECIPES, CATEGORIES } from '../recipes';

export class GameFeelStudioApp {
  private locale: Locale = 'zh';
  private selectedCategory: CategoryId | 'all' = 'all';
  private searchQuery = '';
  private activeRecipe: RecipeDefinition = ALL_RECIPES[4]; // Default: Tamahagane Perfect Deflect!
  private activeInstance: RecipeInstance | null = null;
  private activeGroup: THREE.Group | null = null;
  private paramValues: Record<string, number> = {};

  private juiceEnabled = true;
  private autoDemo = true;
  private inspectorTab: 'params' | 'code' | 'skill' = 'params';

  private stage!: StudioStage;
  private audio = new AudioForge();
  private vfx!: VfxForge;

  private hudCanvas!: HTMLCanvasElement;
  private hudCtx!: CanvasRenderingContext2D;
  private scopeCanvas!: HTMLCanvasElement;
  private scopeCtx!: CanvasRenderingContext2D;
  private telemetryHistory: TelemetryFrame[] = [];

  private calloutEl!: HTMLElement;
  private calloutTimer = 0;
  private hudStatEl!: HTMLElement;

  // DOM containers for selective re-render
  private rootEl: HTMLElement;
  private topbarEl!: HTMLElement;
  private catalogEl!: HTMLElement;
  private overlayTopEl!: HTMLElement;
  private actionBarEl!: HTMLElement;
  private inspectorEl!: HTMLElement;
  private teleLegendEl!: HTMLElement;

  private lastTime = performance.now();
  private elapsed = 0;
  private autoTimer = 0;

  constructor(root: HTMLElement) {
    this.rootEl = root;
    this.buildShell();
    this.selectRecipe(this.activeRecipe.id);
    this.bindEvents();
    requestAnimationFrame((t) => this.loop(t));
  }

  private t(obj: { zh: string; en: string }): string {
    return obj[this.locale];
  }

  private buildShell(): void {
    this.rootEl.innerHTML = `
      <div class="studio-shell">
        <header class="topbar" id="gf-topbar"></header>
        <main class="workbench">
          <aside class="catalog-pane" id="gf-catalog"></aside>
          <section class="stage-pane">
            <div class="viewport-wrap" id="gf-viewport">
              <canvas class="hud-canvas" id="gf-hud-canvas"></canvas>
              <div class="stage-overlay-top" id="gf-overlay-top"></div>
              <div class="callout-banner" id="gf-callout"></div>
              <div class="stage-action-bar" id="gf-action-bar"></div>
            </div>
            <div class="telemetry-bar">
              <div class="tele-legend" id="gf-tele-legend"></div>
              <canvas class="scope-canvas" id="gf-scope-canvas" width="640" height="50"></canvas>
            </div>
          </section>
          <aside class="inspector-pane" id="gf-inspector"></aside>
        </main>
      </div>
    `;

    this.topbarEl = document.getElementById('gf-topbar')!;
    this.catalogEl = document.getElementById('gf-catalog')!;
    this.overlayTopEl = document.getElementById('gf-overlay-top')!;
    this.actionBarEl = document.getElementById('gf-action-bar')!;
    this.inspectorEl = document.getElementById('gf-inspector')!;
    this.teleLegendEl = document.getElementById('gf-tele-legend')!;
    this.calloutEl = document.getElementById('gf-callout')!;

    const vp = document.getElementById('gf-viewport')!;
    this.stage = new StudioStage(vp);
    this.vfx = new VfxForge(this.stage.scene);

    this.hudCanvas = document.getElementById('gf-hud-canvas') as HTMLCanvasElement;
    this.hudCtx = this.hudCanvas.getContext('2d')!;
    this.scopeCanvas = document.getElementById('gf-scope-canvas') as HTMLCanvasElement;
    this.scopeCtx = this.scopeCanvas.getContext('2d')!;

    this.syncViewportSize();
    this.renderTopbar();
    this.renderCatalog();
  }

  private syncViewportSize(): void {
    const vp = document.getElementById('gf-viewport')!;
    const w = Math.max(320, vp.clientWidth);
    const h = Math.max(240, vp.clientHeight);
    this.stage.resize(w, h);
    this.hudCanvas.width = w;
    this.hudCanvas.height = h;
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.syncViewportSize());

    const vp = document.getElementById('gf-viewport')!;
    vp.addEventListener('pointerdown', (ev) => {
      if ((ev.target as HTMLElement).closest('button')) return;
      this.audio.unlock();
      this.triggerPrimary();
    });

    window.addEventListener('keydown', (ev) => {
      if ((ev.target as HTMLElement)?.tagName === 'INPUT') return;
      if (ev.code === 'Space') {
        ev.preventDefault();
        this.audio.unlock();
        this.triggerPrimary();
      } else if (ev.code === 'KeyQ' && this.activeInstance?.secondary) {
        ev.preventDefault();
        this.audio.unlock();
        this.activeInstance.secondary();
      } else if (ev.code === 'KeyR') {
        this.juiceEnabled = !this.juiceEnabled;
        this.renderTopbar();
      }
    });
  }

  private triggerPrimary(): void {
    this.autoTimer = 0;
    this.activeInstance?.trigger();
  }

  private selectRecipe(id: string): void {
    const found = ALL_RECIPES.find((r) => r.id === id) ?? ALL_RECIPES[0];
    if (this.activeInstance?.dispose) this.activeInstance.dispose();
    if (this.activeGroup) {
      this.stage.scene.remove(this.activeGroup);
      this.activeGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    }
    this.vfx.clear();
    this.audio.stopContinuous();
    this.stage.resetFeelState();

    this.activeRecipe = found;
    this.paramValues = {};
    for (const p of found.params) this.paramValues[p.key] = p.defaultValue;

    this.activeGroup = new THREE.Group();
    this.stage.scene.add(this.activeGroup);

    this.renderOverlayAndActions();
    this.activeInstance = found.mount({
      scene: this.stage.scene,
      group: this.activeGroup,
      camera: this.stage.camera,
      stage: this.stage,
      audio: this.audio,
      vfx: this.vfx,
      getParams: () => this.paramValues,
      isJuiceEnabled: () => this.juiceEnabled,
      emitCallout: (text, style = 'gold') => this.showCallout(text, style),
      setHudStat: (label, val) => {
        if (this.hudStatEl) this.hudStatEl.textContent = `${label}: ${val}`;
      },
    });

    this.autoTimer = found.autoDemoInterval * 0.65;
    this.renderCatalog();
    this.renderInspector();
  }

  private showCallout(text: string, style: 'gold' | 'crimson' | 'cyan' | 'emerald'): void {
    const colors = {
      gold: '#f59e0b',
      crimson: '#f43f5e',
      cyan: '#38bdf8',
      emerald: '#10b981',
    };
    this.calloutEl.textContent = text;
    this.calloutEl.style.borderColor = colors[style];
    this.calloutEl.style.color = colors[style];
    this.calloutEl.classList.add('show');
    this.calloutTimer = 1.35;
  }

  private renderTopbar(): void {
    const zh = this.locale === 'zh';
    this.topbarEl.innerHTML = `
      <div class="brand">
        <div class="brand-mark">GF</div>
        <span class="brand-title">gamefeel-3d</span>
        <span class="brand-sub">${zh ? '24 个零资产 Web 3D 打击感/手感配方 + Agent Skill' : '24 Zero-Asset 3D Game-Feel Recipes + Agent Skill'}</span>
      </div>
      <div class="topbar-controls">
        <div class="ab-pill" title="Shortcut: [R]">
          <button class="ab-btn ${this.juiceEnabled ? 'active-juice' : ''}" id="btn-juice-on">
            ⚡ ${zh ? 'GameFeel 开启' : 'GameFeel ON'}
          </button>
          <button class="ab-btn ${!this.juiceEnabled ? 'active-raw' : ''}" id="btn-juice-off">
            🪨 ${zh ? 'Raw 无手感对比' : 'Vibecoded Raw'}
          </button>
        </div>
        <button class="chip-btn ${this.autoDemo ? 'on' : ''}" id="btn-autodemo">
          ${this.autoDemo ? '🔁 AUTO: ON' : '⏸ AUTO: OFF'}
        </button>
        <button class="chip-btn" id="btn-mute">
          ${this.audio.isMuted() ? '🔇 MUTED' : '🔊 AUDIO'}
        </button>
        <button class="chip-btn" id="btn-locale">
          ${zh ? 'EN / 中文' : '中文 / EN'}
        </button>
      </div>
    `;

    document.getElementById('btn-juice-on')!.onclick = () => {
      this.juiceEnabled = true;
      this.renderTopbar();
    };
    document.getElementById('btn-juice-off')!.onclick = () => {
      this.juiceEnabled = false;
      this.audio.stopContinuous();
      this.renderTopbar();
    };
    document.getElementById('btn-autodemo')!.onclick = () => {
      this.autoDemo = !this.autoDemo;
      this.renderTopbar();
    };
    document.getElementById('btn-mute')!.onclick = () => {
      this.audio.unlock();
      this.audio.setMuted(!this.audio.isMuted());
      this.renderTopbar();
    };
    document.getElementById('btn-locale')!.onclick = () => {
      this.locale = this.locale === 'zh' ? 'en' : 'zh';
      this.renderTopbar();
      this.renderCatalog();
      this.renderOverlayAndActions();
      this.renderInspector();
    };
  }

  private renderCatalog(): void {
    const zh = this.locale === 'zh';
    const q = this.searchQuery.trim().toLowerCase();
    const list = ALL_RECIPES.filter((r) => {
      if (this.selectedCategory !== 'all' && r.category !== this.selectedCategory) return false;
      if (!q) return true;
      return (
        r.id.includes(q) ||
        r.title.zh.toLowerCase().includes(q) ||
        r.title.en.toLowerCase().includes(q) ||
        r.tags.some((tag) => tag.includes(q))
      );
    });

    this.catalogEl.innerHTML = `
      <div class="cat-filter-grid">
        <button class="cat-pill ${this.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">
          ALL (${ALL_RECIPES.length})
        </button>
        ${CATEGORIES.map(
          (c) => `
          <button class="cat-pill ${this.selectedCategory === c.id ? 'active' : ''}" data-cat="${c.id}">
            ${c.icon} ${this.t(c.name)}
          </button>
        `
        ).join('')}
      </div>
      <div class="search-box">
        <input id="gf-search" type="text" value="${this.searchQuery}" placeholder="${
          zh ? '搜索手感配方（如 deflect / recoil / drift / hitstop）...' : 'Search recipes (deflect, recoil, drift, hitstop)...'
        }" />
      </div>
      <div class="recipe-list">
        ${list
          .map(
            (r) => `
          <button class="recipe-card ${r.id === this.activeRecipe.id ? 'selected' : ''}" data-rid="${r.id}">
            <div class="rc-top">
              <span class="rc-badge">${r.badge}</span>
              <span style="font-size:11px;color:var(--text-2);font-family:var(--mono)">${r.category.toUpperCase()}</span>
            </div>
            <div class="rc-title">${this.t(r.title)}</div>
            <div class="rc-sub">${this.t(r.subtitle)}</div>
          </button>
        `
          )
          .join('')}
      </div>
    `;

    this.catalogEl.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((btn) => {
      btn.onclick = () => {
        this.selectedCategory = btn.dataset.cat as CategoryId | 'all';
        this.renderCatalog();
      };
    });

    this.catalogEl.querySelectorAll<HTMLButtonElement>('[data-rid]').forEach((btn) => {
      btn.onclick = () => {
        this.audio.unlock();
        this.selectRecipe(btn.dataset.rid!);
      };
    });

    const input = document.getElementById('gf-search') as HTMLInputElement;
    input.oninput = () => {
      this.searchQuery = input.value;
      const pos = input.selectionStart ?? input.value.length;
      this.renderCatalog();
      const next = document.getElementById('gf-search') as HTMLInputElement;
      next.focus();
      next.setSelectionRange(pos, pos);
    };
  }

  private renderOverlayAndActions(): void {
    const r = this.activeRecipe;
    const zh = this.locale === 'zh';
    this.overlayTopEl.innerHTML = `
      <div class="active-banner">
        <h2>${r.badge} · ${this.t(r.title)}</h2>
        <p>${this.t(r.subtitle)}</p>
      </div>
      <div class="hud-stat-pill" id="gf-hud-stat">READY</div>
    `;
    this.hudStatEl = document.getElementById('gf-hud-stat')!;

    this.actionBarEl.innerHTML = `
      <div class="action-btns">
        <button class="fire-btn" id="btn-trigger">
          ⚡ ${zh ? '触发体验 [Space / 点击画面]' : 'Trigger Feel [Space / Click]'}
        </button>
        ${
          r.hasSecondary
            ? `<button class="sec-btn" id="btn-secondary">[Q] ${this.t(r.hasSecondary)}</button>`
            : ''
        }
      </div>
      <div class="hint-caption">${this.t(r.controlsHint)}</div>
    `;

    document.getElementById('btn-trigger')!.onclick = () => {
      this.audio.unlock();
      this.triggerPrimary();
    };
    const sec = document.getElementById('btn-secondary');
    if (sec) {
      sec.onclick = () => {
        this.audio.unlock();
        this.activeInstance?.secondary?.();
      };
    }
  }

  private renderInspector(): void {
    const r = this.activeRecipe;
    const zh = this.locale === 'zh';

    let bodyHtml = '';
    if (this.inspectorTab === 'params') {
      bodyHtml = `
        <div class="insight-box">
          <div class="insight-label" style="color:var(--amber)">✦ ${zh ? '为什么有打击感 / 爽感原理' : 'WHY IT FEELS GOOD'}</div>
          <p>${this.t(r.whyItMatters)}</p>
        </div>
        <div class="insight-box">
          <div class="insight-label" style="color:var(--crimson)">⚠ ${zh ? 'AI 默认 Vibecode 常见毛病' : 'VIBECODED SLOP SYMPTOM'}</div>
          <p>${this.t(r.rawProblem)}</p>
        </div>
        <div class="param-group">
          ${r.params
            .map((p) => {
              const val = this.paramValues[p.key];
              return `
              <div class="param-item">
                <div class="param-head">
                  <span>${this.t(p.label)}</span>
                  <span class="param-val" id="pval-${p.key}">${val}${p.unit ?? ''}</span>
                </div>
                <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${val}" data-pkey="${p.key}" data-unit="${p.unit ?? ''}" />
              </div>
            `;
            })
            .join('')}
        </div>
      `;
    } else if (this.inspectorTab === 'code') {
      const snippet = r.generateCode(this.paramValues);
      bodyHtml = `
        <div class="code-card">
          <div class="code-card-head">
            <span>${r.id}.ts (Zero-Dependency)</span>
            <button class="copy-btn" id="btn-copy-code">${zh ? '复制 TS 源码' : 'Copy TS'}</button>
          </div>
          <pre class="code-pre" id="gf-code-block"></pre>
        </div>
      `;
      setTimeout(() => {
        const pre = document.getElementById('gf-code-block');
        if (pre) pre.textContent = snippet;
        const copyBtn = document.getElementById('btn-copy-code');
        if (copyBtn) {
          copyBtn.onclick = () => {
            void navigator.clipboard.writeText(snippet);
            copyBtn.textContent = zh ? '✓ 已复制!' : '✓ Copied!';
            setTimeout(() => (copyBtn.textContent = zh ? '复制 TS 源码' : 'Copy TS'), 1400);
          };
        }
      }, 0);
    } else {
      const installCmd = `npx skills add dyc19991225/gamefeel-3d`;
      const codexPrompt = zh
        ? `$gamefeel-3d ${this.t(r.agentPrompt).replace(/^使用 gamefeel-3d 技能：/, '')}`
        : `$gamefeel-3d ${this.t(r.agentPrompt).replace(/^Use gamefeel-3d skill:\s*/i, '')}`;
      const auditPrompt = zh
        ? `$gamefeel-3d 对照 12 条反塑料感清单扫描我当前的 Three.js 项目，列出最缺失的手感通道，并按优先级逐项升级（震屏、顿帧、弹簧反馈与零 MP3 合成音效）。`
        : `$gamefeel-3d Audit my current Three.js project against the 12-rule anti-slop checklist, rank the top missing feel channels, and upgrade them step by step.`;
      bodyHtml = `
        <div class="code-card">
          <div class="code-card-head">
            <span>1. ${zh ? '安装 Skill（Codex / Claude / AGY）' : 'Install Skill (Codex / Claude / AGY)'}</span>
            <button class="copy-btn" id="btn-copy-install">${zh ? '复制命令' : 'Copy'}</button>
          </div>
          <pre class="code-pre">${installCmd}</pre>
        </div>
        <div class="code-card">
          <div class="code-card-head">
            <span>2. ${zh ? 'Codex 风格当前配方引导词 ($gamefeel-3d)' : 'Codex-Style Recipe Prompt ($gamefeel-3d)'}</span>
            <button class="copy-btn" id="btn-copy-prompt">${zh ? '复制引导词' : 'Copy Prompt'}</button>
          </div>
          <pre class="code-pre" id="gf-prompt-block"></pre>
        </div>
        <div class="code-card">
          <div class="code-card-head">
            <span>3. ${zh ? '全项目诊断改造引导词（通用）' : 'Full-Project Audit Starter Prompt'}</span>
            <button class="copy-btn" id="btn-copy-audit">${zh ? '复制诊断词' : 'Copy Audit'}</button>
          </div>
          <pre class="code-pre" id="gf-audit-block"></pre>
        </div>
      `;
      setTimeout(() => {
        const pBlock = document.getElementById('gf-prompt-block');
        if (pBlock) pBlock.textContent = codexPrompt;
        const aBlock = document.getElementById('gf-audit-block');
        if (aBlock) aBlock.textContent = auditPrompt;
        document.getElementById('btn-copy-install')!.onclick = (e) => {
          void navigator.clipboard.writeText(installCmd);
          (e.target as HTMLElement).textContent = '✓';
        };
        document.getElementById('btn-copy-prompt')!.onclick = (e) => {
          void navigator.clipboard.writeText(codexPrompt);
          (e.target as HTMLElement).textContent = zh ? '✓ 已复制!' : '✓ Copied!';
        };
        document.getElementById('btn-copy-audit')!.onclick = (e) => {
          void navigator.clipboard.writeText(auditPrompt);
          (e.target as HTMLElement).textContent = zh ? '✓ 已复制!' : '✓ Copied!';
        };
      }, 0);
    }

    this.inspectorEl.innerHTML = `
      <div class="tab-strip">
        <button class="tab-btn ${this.inspectorTab === 'params' ? 'active' : ''}" data-tab="params">
          🎛️ ${zh ? '实时调参' : 'Live Params'}
        </button>
        <button class="tab-btn ${this.inspectorTab === 'code' ? 'active' : ''}" data-tab="code">
          📦 ${zh ? '独立源码' : 'Recipe TS'}
        </button>
        <button class="tab-btn ${this.inspectorTab === 'skill' ? 'active' : ''}" data-tab="skill">
          🤖 ${zh ? 'AI 技能调用' : 'Agent Skill'}
        </button>
      </div>
      <div class="inspector-body">${bodyHtml}</div>
    `;

    this.inspectorEl.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      b.onclick = () => {
        this.inspectorTab = b.dataset.tab as 'params' | 'code' | 'skill';
        this.renderInspector();
      };
    });

    this.inspectorEl.querySelectorAll<HTMLInputElement>('[data-pkey]').forEach((slider) => {
      slider.oninput = () => {
        const key = slider.dataset.pkey!;
        const unit = slider.dataset.unit ?? '';
        const val = parseFloat(slider.value);
        this.paramValues[key] = val;
        const label = document.getElementById(`pval-${key}`);
        if (label) label.textContent = `${val}${unit}`;
      };
    });
  }

  private drawHudOverlay(): void {
    const g = this.hudCtx;
    const w = this.hudCanvas.width;
    const h = this.hudCanvas.height;
    g.clearRect(0, 0, w, h);

    // 1. Vignette (bullet-time / perilous tension)
    if (this.stage.vignetteIntensity > 0.01) {
      const grad = g.createRadialGradient(w / 2, h / 2, h * 0.22, w / 2, h / 2, Math.max(w, h) * 0.68);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(124, 32, 96, ${this.stage.vignetteIntensity * 0.55})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }

    // 2. Radial Speed Lines (N2O / CWW boost)
    if (this.stage.speedLinesIntensity > 0.02) {
      g.save();
      g.translate(w / 2, h / 2);
      g.strokeStyle = `rgba(186, 230, 253, ${Math.min(0.6, this.stage.speedLinesIntensity * 0.55)})`;
      g.lineWidth = 2;
      const lines = 28;
      for (let i = 0; i < lines; i++) {
        const a = (i / lines) * Math.PI * 2 + ((this.elapsed * 9) % 0.4);
        const r0 = Math.min(w, h) * (0.3 + ((i * 17) % 10) * 0.014);
        const r1 = Math.max(w, h) * 0.65;
        g.beginPath();
        g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        g.stroke();
      }
      g.restore();
    }

    // 3. Directional Damage Indicator Red Arc
    if (this.stage.damageArcAlpha > 0.02) {
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate(this.stage.damageArcAngle - Math.PI / 2);
      g.strokeStyle = `rgba(244, 63, 94, ${this.stage.damageArcAlpha})`;
      g.lineWidth = 10;
      g.beginPath();
      g.arc(0, 0, Math.min(w, h) * 0.24, -0.45, 0.45);
      g.stroke();
      g.restore();
    }

    // 4. Dynamic FPS Crosshair
    if (this.stage.crosshairGap > 0) {
      const cx = w / 2;
      const cy = h / 2;
      const gap = this.stage.crosshairGap;
      g.strokeStyle = 'rgba(74, 222, 128, 0.92)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - gap - 9, cy);
      g.lineTo(cx - gap, cy);
      g.moveTo(cx + gap, cy);
      g.lineTo(cx + gap + 9, cy);
      g.moveTo(cx, cy - gap - 9);
      g.lineTo(cx, cy - gap);
      g.moveTo(cx, cy + gap);
      g.lineTo(cx, cy + gap + 9);
      g.stroke();
    }
  }

  private drawTelemetry(frame: TelemetryFrame): void {
    this.telemetryHistory.push(frame);
    if (this.telemetryHistory.length > 160) this.telemetryHistory.shift();

    this.teleLegendEl.innerHTML = `
      <div class="tele-row"><span style="color:#f59e0b">■ TRAUMA²</span><span>${(frame.trauma * 100).toFixed(0)}%</span></div>
      <div class="tele-row"><span style="color:#38bdf8">■ TIMESCALE</span><span>${frame.timeScale.toFixed(2)}×</span></div>
      <div class="tele-row"><span style="color:#10b981">■ FOV DELTA</span><span>${frame.fovOffset >= 0 ? '+' : ''}${frame.fovOffset.toFixed(1)}°</span></div>
    `;

    const g = this.scopeCtx;
    const w = this.scopeCanvas.width;
    const h = this.scopeCanvas.height;
    g.clearRect(0, 0, w, h);

    const plot = (pick: (f: TelemetryFrame) => number, color: string) => {
      g.strokeStyle = color;
      g.lineWidth = 1.6;
      g.beginPath();
      this.telemetryHistory.forEach((f, idx) => {
        const x = (idx / 160) * w;
        const y = h - THREE.MathUtils.clamp(pick(f), 0.04, 0.96) * h;
        if (idx === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();
    };

    plot((f) => f.trauma, '#f59e0b');
    plot((f) => f.timeScale * 0.85, '#38bdf8');
    plot((f) => 0.5 + f.fovOffset / 55, '#10b981');
  }

  private loop(now: number): void {
    const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.elapsed += rawDt;

    const { scaledDt } = this.stage.clock.step(rawDt);

    if (this.autoDemo) {
      this.autoTimer -= rawDt;
      if (this.autoTimer <= 0) {
        this.autoTimer = this.activeRecipe.autoDemoInterval;
        this.activeInstance?.trigger();
      }
    }

    if (this.calloutTimer > 0) {
      this.calloutTimer -= rawDt;
      if (this.calloutTimer <= 0) this.calloutEl.classList.remove('show');
    }

    this.activeInstance?.update(rawDt, scaledDt, this.elapsed);
    this.vfx.update(rawDt, this.stage.camera);
    const tele = this.stage.stepCamera(rawDt);
    this.stage.renderer.render(this.stage.scene, this.stage.camera);

    this.drawHudOverlay();
    this.drawTelemetry(tele);

    requestAnimationFrame((t) => this.loop(t));
  }
}
