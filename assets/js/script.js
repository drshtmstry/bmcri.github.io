document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // --- 1. CORE UTILITY: Auto-Detect Base URL ---
    // This finds the "style.css" link in your HTML and calculates 
    // how many folders deep we are (e.g., "../" or "../../").
    const getBaseUrl = () => {
        const cssLink = document.querySelector('link[href*="style.css"]');

        // Safety fallback if style.css isn't found
        if (!cssLink) return window.SITE_BASE || "./";

        // Get the href (e.g., "../assets/css/style.css")
        const href = cssLink.getAttribute('href');

        // We know style.css is inside "assets/...", so we split the string there.
        // If href is "assets/css/..." -> prefix is "" (mapped to "./")
        // If href is "../assets/css/..." -> prefix is "../"
        const prefix = href.split("assets/")[0];

        return prefix === "" ? "./" : prefix;
    };

    // --- CONFIGURATION ---
    const CONFIG = {
        slideshowUrl: "assets/slideshow/slideshow.json", // Path relative to site root
        //    useCache: true,
        baseUrl: getBaseUrl() // Auto-calculated base
    };

    console.log("System Base URL:", CONFIG.baseUrl);

    // --- 2. LINK FIXER ---

    /**
     * Fixes relative links (img src, a href) in injected HTML
     * so they work from any sub-folder depth.
     */
    const fixRelativeLinks = (container) => {
        if (!container) return;

        // Select everything that links to a file
        const selectors = 'a[href], img[src], link[href], script[src], source[src]';
        const elements = container.querySelectorAll(selectors);

        elements.forEach(element => {
            const attr = (element.tagName === 'IMG' || element.tagName === 'SCRIPT' || element.tagName === 'SOURCE') ? 'src' : 'href';
            const val = element.getAttribute(attr);

            // 1. Skip if empty, absolute (http), anchors (#), mailto, or javascript
            if (!val || /^(http|\/\/|mailto:|tel:|#|data:|javascript:)/.test(val)) return;

            // 2. Clean the path: Remove existing ./ or ../ prefixes
            // We want the "pure" path relative to the root (e.g. "assets/logo.webp")
            let cleanPath = val;

            // Remove all occurrences of "../" or "./" from the start
            while (cleanPath.startsWith('../') || cleanPath.startsWith('./')) {
                cleanPath = cleanPath.replace(/^(\.\.?\/)/, '');
            }

            // 3. Prepend the calculated Base URL
            // e.g., "../" + "assets/logo.webp"
            element.setAttribute(attr, CONFIG.baseUrl + cleanPath);
        });
    };

    /**
     * Fetches HTML content with caching support.
     */
    const fetchComponent = async (filename) => {
        const cacheKey = `bmc_cache_${filename}`;

        if (CONFIG.useCache) {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) return cached;
        }

        try {
            // Fetch relative to the calculated base
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
        // Check if main content is empty (needs homepage loaded) or has static content
        const needsMain = mainContentArea && !mainContentArea.innerHTML.trim();

        // -- 1. Load Header --
        fetchComponent('header.html').then(html => {
            if (html) {
                const headerEl = document.getElementById('global-header');
                headerEl.innerHTML = html;
                fixRelativeLinks(headerEl); // Apply URL fix immediately
                initializeNavigation();
                syncHeaderHeight();
            }
        });

        // -- 2. Load Homepage (if needed) --
        if (needsMain) {
            fetchComponent('homepage.html').then(html => {
                if (html) {
                    mainContentArea.innerHTML = html;
                    fixRelativeLinks(mainContentArea); // Fix image/link paths in homepage
                    initObservers();
                    initializeSlideshow();
                }
            });
        } else {
            // If page is static (like About Us), we still must fix links 
            // because the HTML might have "assets/img.jpg" hardcoded
            fixRelativeLinks(mainContentArea);
            initObservers();
        }

        // -- 3. Load Footer --
        fetchComponent('footer.html').then(html => {
            if (html) {
                const footerEl = document.getElementById('global-footer');
                footerEl.innerHTML = html;
                fixRelativeLinks(footerEl); // Fix social icons and links

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

    // --- 5. SLIDESHOW LOGIC ---
    const initializeSlideshow = async () => {
        const container = document.getElementById("dynamic-slideshow");
        if (!container) return;

        try {
            // Fetch JSON using the dynamic base URL
            const response = await fetch(CONFIG.baseUrl + CONFIG.slideshowUrl);
            if (!response.ok) return;

            let images = await response.json();
            // Shuffle
            for (let i = images.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [images[i], images[j]] = [images[j], images[i]];
            }

            const overlay = container.querySelector(".slide-overlay");

            images.forEach((src, index) => {
                const slide = document.createElement("div");
                slide.className = `hero-slide ${index === 0 ? "active" : ""}`;
                const priority = index === 0 ? 'fetchpriority="high"' : 'loading="lazy"';

                // IMPORTANT: Construct image source using dynamic base
                // Assumption: 'src' in JSON is just the filename (e.g. "slide1.jpg")
                const fullSrc = `${CONFIG.baseUrl}assets/slideshow/${src}`;

                slide.innerHTML = `<img src="${fullSrc}" alt="Slide" ${priority}>`;
                container.insertBefore(slide, overlay);
            });

            // Start Logic
            let currentIndex = 0;
            const slides = container.querySelectorAll(".hero-slide");

            if (slides.length > 1) {
                const showSlide = (idx) => {
                    slides[currentIndex].classList.remove("active");
                    currentIndex = (idx + slides.length) % slides.length;
                    slides[currentIndex].classList.add("active");
                };

                let interval = setInterval(() => showSlide(currentIndex + 1), 5000);

                const resetTimer = () => { clearInterval(interval); interval = setInterval(() => showSlide(currentIndex + 1), 5000); };
                const nextBtn = container.querySelector(".next");
                const prevBtn = container.querySelector(".prev");

                if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); showSlide(currentIndex + 1); resetTimer(); };
                if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); showSlide(currentIndex - 1); resetTimer(); };
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

    // --- START ---
    loadComponents();
    initializeAccordions();
});

// --- GLOBAL HELPERS (Outside DOMContentLoaded) ---
let resizeTimer;
const syncHeaderHeight = () => {
    const header = document.querySelector('.glass-nav');
    if (header) {
        document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
    }
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