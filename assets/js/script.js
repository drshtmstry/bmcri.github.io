document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // --- 1. CORE UTILITY: Auto-Detect Base URL ---
    const getBaseUrl = () => {
        const cssLink = document.querySelector('link[href*="style.css"]');
        if (!cssLink) return window.SITE_BASE || "./";
        const href = cssLink.getAttribute('href');
        const prefix = href.split("assets/")[0];
        return prefix === "" ? "./" : prefix;
    };

    // --- CONFIGURATION ---
    const CONFIG = {
        slideshowUrl: "assets/slideshow/slideshow.json",
        useCache: true,
        baseUrl: getBaseUrl()
    };

    console.log("System Base URL:", CONFIG.baseUrl);

    // --- 2. LINK FIXER ---
    const fixRelativeLinks = (container) => {
        if (!container) return;
        const selectors = 'a[href], img[src], link[href], script[src], source[src]';
        const elements = container.querySelectorAll(selectors);

        elements.forEach(element => {
            const attr = (element.tagName === 'IMG' || element.tagName === 'SCRIPT' || element.tagName === 'SOURCE') ? 'src' : 'href';
            const val = element.getAttribute(attr);
            if (!val || /^(http|\/\/|mailto:|tel:|#|data:|javascript:)/.test(val)) return;
            let cleanPath = val;
            while (cleanPath.startsWith('../') || cleanPath.startsWith('./')) {
                cleanPath = cleanPath.replace(/^(\.\.?\/)/, '');
            }
            element.setAttribute(attr, CONFIG.baseUrl + cleanPath);
        });
    };

    const fetchComponent = async (filename) => {
        const cacheKey = `bmc_cache_${filename}`;
        if (CONFIG.useCache) {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) return cached;
        }
        try {
            const response = await fetch(CONFIG.baseUrl + filename);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            if (CONFIG.useCache) sessionStorage.setItem(cacheKey, html);
            return html;
        } catch (error) {
            console.error(`Failed to load ${filename}:`, error);
            return null;
        }
    };

    // --- 3. COMPONENT LOADER ---
    const loadComponents = async () => {
        const mainContentArea = document.getElementById("main-content-area");
        const needsMain = mainContentArea && !mainContentArea.innerHTML.trim();

        fetchComponent('header.html').then(html => {
            if (html) {
                const headerEl = document.getElementById('global-header');
                headerEl.innerHTML = html;
                fixRelativeLinks(headerEl);
                initializeNavigation();
                syncHeaderHeight();
            }
        });

        if (needsMain) {
            fetchComponent('homepage.html').then(html => {
                if (html) {
                    mainContentArea.innerHTML = html;
                    fixRelativeLinks(mainContentArea);
                    initObservers();
                    // START SLIDESHOW AFTER LOADING HOME
                    initializeSlideshow();
                }
            });
        } else {
            fixRelativeLinks(mainContentArea);
            initObservers();
        }

        fetchComponent('footer.html').then(html => {
            if (html) {
                const footerEl = document.getElementById('global-footer');
                footerEl.innerHTML = html;
                fixRelativeLinks(footerEl);
                const yearSpan = document.getElementById("current-year");
                if (yearSpan) yearSpan.textContent = new Date().getFullYear();
                initFooterInteractions();
            }
        });
    };

    // --- 4. ANIMATION & OBSERVERS ---
    const initObservers = () => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    };

    // --- 5. REVISED SLIDESHOW LOGIC ---
    const initializeSlideshow = async () => {
        const container = document.getElementById("dynamic-slideshow");
        if (!container) return;

        try {
            // 1. Identify the hardcoded image to avoid duplication
            // We look for the image src inside the existing active slide
            const existingSlide = container.querySelector(".hero-slide.active img");
            const existingSrc = existingSlide ? existingSlide.getAttribute("src") : "";

            const response = await fetch(CONFIG.baseUrl + CONFIG.slideshowUrl);
            if (!response.ok) return;

            let rawImages = await response.json();

            // 2. Filter out the image that is already in the HTML
            // We check if the existing src includes the filename from JSON
            let finalImages = rawImages.filter(img => !existingSrc.includes(img));

            // 3. Shuffle the REMAINING images
            for (let i = finalImages.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [finalImages[i], finalImages[j]] = [finalImages[j], finalImages[i]];
            }

            // 4. Render only the NEW slides
            const overlay = container.querySelector(".slide-overlay");

            finalImages.forEach((src) => {
                const slide = document.createElement("div");
                slide.className = "hero-slide"; // No 'active' class, the HTML one has it

                const fullSrc = `${CONFIG.baseUrl}assets/slideshow/${src}`;

                // All dynamic slides are secondary, so lazy load them
                slide.innerHTML = `<img src="${fullSrc}" alt="Slide" loading="lazy">`;

                container.insertBefore(slide, overlay);
            });

            // 5. Start the Logic (Controls & Timer)
            // We re-query the DOM to include BOTH the hardcoded slide and the new ones
            const slides = container.querySelectorAll(".hero-slide");
            let currentIndex = 0; // Starts at 0 (the hardcoded one)
            let timer = null;

            const showNextSlide = () => {
                slides[currentIndex].classList.remove("active");
                currentIndex = (currentIndex + 1) % slides.length;
                slides[currentIndex].classList.add("active");
                scheduleNext();
            };

            const scheduleNext = () => {
                if (timer) clearTimeout(timer);
                // Wait 5s for the first slide, 3s for the rest
                const delay = currentIndex === 0 ? 5000 : 3000;
                timer = setTimeout(showNextSlide, delay);
            };

            // Start the loop if we have more than 1 slide (1 hardcoded + others)
            if (slides.length > 1) {
                scheduleNext();

                // Controls
                const nextBtn = container.querySelector(".next");
                const prevBtn = container.querySelector(".prev");

                if (nextBtn) nextBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (timer) clearTimeout(timer);
                    slides[currentIndex].classList.remove("active");
                    currentIndex = (currentIndex + 1) % slides.length;
                    slides[currentIndex].classList.add("active");
                    scheduleNext();
                };

                if (prevBtn) prevBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (timer) clearTimeout(timer);
                    slides[currentIndex].classList.remove("active");
                    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
                    slides[currentIndex].classList.add("active");
                    scheduleNext();
                };
            }

        } catch (e) {
            console.warn("Slideshow skipped or failed:", e);
        }
    };

    // --- 6. NAVIGATION LOGIC ---
    const initializeNavigation = () => {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const navList = document.querySelector(".nav-list");
        const menuBtn = document.querySelector(".mobile-menu-toggle");
        const sidebarOverlay = document.getElementById("sidebar-overlay");

        document.querySelectorAll(".nav-list a").forEach(link => {
            const href = link.getAttribute("href");
            if (!href) return;
            const linkFile = href.split('/').pop();
            if (linkFile === currentPath) {
                link.classList.add("active");
                link.closest(".has-submenu")?.querySelector(":scope > a")?.classList.add("active");
                link.closest(".nav-item")?.querySelector(".nav-link")?.classList.add("active");
            }
        });

        if (menuBtn && navList) {
            const toggleMenu = (forceClose) => {
                const isActive = forceClose ? false : !navList.classList.contains("active");
                navList.classList.toggle("active", isActive);
                menuBtn.classList.toggle("active", isActive);
                if (sidebarOverlay) sidebarOverlay.classList.toggle("active", isActive);
                document.body.style.overflow = isActive ? "hidden" : "";
            };
            menuBtn.onclick = (e) => { e.stopPropagation(); toggleMenu(); };
            if (sidebarOverlay) sidebarOverlay.onclick = () => toggleMenu(true);
            navList.onclick = (e) => {
                const link = e.target.closest("a");
                if (!link || link.id === "mobile-theme-toggle") return;
                const nextEl = link.nextElementSibling;
                if (nextEl && (nextEl.matches('.dropdown-menu') || nextEl.matches('.dropdown-submenu'))) {
                    if (window.innerWidth <= 1024) {
                        e.preventDefault();
                        e.stopPropagation();
                        link.parentElement.classList.toggle("dropdown-active");
                    }
                } else {
                    toggleMenu(true);
                }
            };
        }
    };

    // --- 7. FOOTER INTERACTIONS ---
    const initFooterInteractions = () => {
        const copyrightBar = document.querySelector('.copyright-bar');
        const themeBtn = document.getElementById('theme-toggle');
        if (copyrightBar && themeBtn) {
            const footerObserver = new IntersectionObserver(([entry]) => {
                themeBtn.classList.toggle('lift-up', entry.isIntersecting);
            }, { threshold: 0.1 });
            footerObserver.observe(copyrightBar);
        }
    };

    // --- 8. ACCORDION LOGIC ---
    const initializeAccordions = () => {
        document.body.addEventListener('click', (e) => {
            const toggle = e.target.closest('.expand-toggle');
            if (toggle) {
                toggle.classList.toggle('active');
                const content = toggle.parentElement.querySelector('.expand-area');
                if (content) content.classList.toggle('open');
            }
        });
    };

    loadComponents();
    initializeAccordions();
});

// --- GLOBAL HELPERS ---
let resizeTimer;
const syncHeaderHeight = () => {
    const header = document.querySelector('.glass-nav');
    if (header) document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
};
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncHeaderHeight, 100);
});
window.addEventListener('orientationchange', syncHeaderHeight);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('load', () => {
    syncHeaderHeight();
    if (location.hash) {
        setTimeout(() => {
            const target = document.querySelector(location.hash);
            if (target) {
                const offset = getComputedStyle(document.documentElement).getPropertyValue('--header-height');
                const headerH = parseInt(offset) || 60;
                const top = target.getBoundingClientRect().top + window.scrollY - headerH - 10;
                window.scrollTo({ top: top, behavior: 'smooth' });
            }
        }, 100);
    }
});