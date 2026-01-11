document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // --- CONFIGURATION ---
    const CONFIG = {
        slideshowUrl: "assets/slideshow/slideshow.json",
        useCache: true, // Set to false during active development
        // Fallback if window.SITE_BASE isn't set in HTML
        baseUrl: window.SITE_BASE || document.querySelector('base')?.href || "./"
    };

    console.log("Base URL:", CONFIG.baseUrl);

    // --- 1. CORE UTILITIES ---

    /**
     * Fixes relative links within a specific container only.
     * much faster than scanning the whole document.
     */
    const fixRelativeLinks = (container) => {
        if (!container) return;

        const selectors = 'a[href], img[src], link[href], script[src]';
        const elements = container.querySelectorAll(selectors);

        elements.forEach(element => {
            const attr = element.tagName === 'IMG' || element.tagName === 'SCRIPT' ? 'src' : 'href';
            const val = element.getAttribute(attr);

            // Skip absolute links, anchors, data URIs, or javascript:
            if (!val || /^(http|\/\/|mailto:|tel:|#|data:|javascript:)/.test(val)) return;

            // Clean path (remove ./ or ../)
            let cleanPath = val.replace(/^(\.?\/)/, '');
            while (cleanPath.startsWith('../')) {
                cleanPath = cleanPath.substring(3);
            }

            element.setAttribute(attr, CONFIG.baseUrl + cleanPath);
        });
    };

    /**
     * Fetches HTML content with caching support.
     */
    const fetchComponent = async (filename) => {
        const cacheKey = `bmc_cache_${filename}`;

        // 1. Try Cache first
        if (CONFIG.useCache) {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) return cached;
        }

        // 2. Network Fetch
        try {
            const response = await fetch(CONFIG.baseUrl + filename);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();

            // Save to cache
            if (CONFIG.useCache) sessionStorage.setItem(cacheKey, html);
            return html;
        } catch (error) {
            console.error(`Failed to load ${filename}:`, error);
            return null;
        }
    };

    // --- 2. COMPONENT LOADER (Render-on-Arrival Strategy) ---
    const loadComponents = async () => {
        const mainContentArea = document.getElementById("main-content-area");
        // Only fetch homepage content if the container exists and is empty
        const needsMain = mainContentArea && !mainContentArea.innerHTML.trim();

        // -- Load Critical Components (Parallel but Independent) --

        // 1. Header
        fetchComponent('header.html').then(html => {
            if (html) {
                const headerEl = document.getElementById('global-header');
                headerEl.innerHTML = html;
                fixRelativeLinks(headerEl);
                initializeNavigation(); // Init nav immediately after header loads
                syncHeaderHeight();     // Calc height immediately
            }
        });

        // 2. Main Content (Homepage)
        if (needsMain) {
            fetchComponent('homepage.html').then(html => {
                if (html) {
                    mainContentArea.innerHTML = html;
                    fixRelativeLinks(mainContentArea);
                    initObservers();      // Start animations
                    initializeSlideshow();// Start slideshow
                }
            });
        } else {
            // If main content was already there (static page), just init observers
            fixRelativeLinks(mainContentArea); // Fix links in static content too
            initObservers();
        }

        // 3. Footer (Non-critical, let it load whenever)
        fetchComponent('footer.html').then(html => {
            if (html) {
                const footerEl = document.getElementById('global-footer');
                footerEl.innerHTML = html;
                fixRelativeLinks(footerEl);

                // Set Year
                const yearSpan = document.getElementById("current-year");
                if (yearSpan) yearSpan.textContent = new Date().getFullYear();

                // Setup Footer Interactions
                initFooterInteractions();
            }
        });
    };

    // --- 3. ANIMATION & OBSERVERS ---
    const initObservers = () => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        // Observe elements in main content and footer
        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    };

    // --- 4. SLIDESHOW LOGIC ---
    const initializeSlideshow = async () => {
        const container = document.getElementById("dynamic-slideshow");
        if (!container) return;

        try {
            const response = await fetch(CONFIG.baseUrl + CONFIG.slideshowUrl);
            if (!response.ok) return;

            let images = await response.json();
            // Shuffle images
            for (let i = images.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [images[i], images[j]] = [images[j], images[i]];
            }

            const overlay = container.querySelector(".slide-overlay");

            // Create slides
            images.forEach((src, index) => {
                const slide = document.createElement("div");
                slide.className = `hero-slide ${index === 0 ? "active" : ""}`;
                // High priority for first image only
                const priority = index === 0 ? 'fetchpriority="high"' : 'loading="lazy"';
                slide.innerHTML = `<img src="${CONFIG.baseUrl}assets/slideshow/${src}" alt="Slide" ${priority}>`;
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

                // Controls
                const resetTimer = () => { clearInterval(interval); interval = setInterval(() => showSlide(currentIndex + 1), 5000); };

                const nextBtn = container.querySelector(".next");
                const prevBtn = container.querySelector(".prev");

                if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); showSlide(currentIndex + 1); resetTimer(); };
                if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); showSlide(currentIndex - 1); resetTimer(); };
            }

        } catch (e) {
            console.warn("Slideshow skipped:", e);
        }
    };

    // --- 5. NAVIGATION ---
    const initializeNavigation = () => {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const navList = document.querySelector(".nav-list");
        const menuBtn = document.querySelector(".mobile-menu-toggle");
        const sidebarOverlay = document.getElementById("sidebar-overlay");

        // Set Active Links
        document.querySelectorAll(".nav-list a").forEach(link => {
            const href = link.getAttribute("href");
            if (!href) return;
            const linkFile = href.split('/').pop();

            if (linkFile === currentPath) {
                link.classList.add("active");
                // Highlight parents
                link.closest(".has-submenu")?.querySelector(":scope > a")?.classList.add("active");
                link.closest(".nav-item")?.querySelector(".nav-link")?.classList.add("active");
            }
        });

        // Mobile Menu Logic
        if (menuBtn && navList) {
            const toggleMenu = (forceClose) => {
                const isActive = forceClose ? false : !navList.classList.contains("active");
                navList.classList.toggle("active", isActive);
                menuBtn.classList.toggle("active", isActive);
                if (sidebarOverlay) sidebarOverlay.classList.toggle("active", isActive);

                // Scroll Lock
                document.body.style.overflow = isActive ? "hidden" : "";
            };

            menuBtn.onclick = (e) => { e.stopPropagation(); toggleMenu(); };
            if (sidebarOverlay) sidebarOverlay.onclick = () => toggleMenu(true);

            // Dropdown Toggles on Mobile
            navList.onclick = (e) => {
                const link = e.target.closest("a");
                if (!link) return;
                if (link.id === "mobile-theme-toggle") return;

                const nextEl = link.nextElementSibling;
                // Check if it's a dropdown trigger
                if (nextEl && (nextEl.matches('.dropdown-menu') || nextEl.matches('.dropdown-submenu'))) {
                    if (window.innerWidth <= 1024) { // Only prevent default on mobile
                        e.preventDefault();
                        e.stopPropagation();
                        link.parentElement.classList.toggle("dropdown-active");
                    }
                } else {
                    // It's a regular link, close menu
                    toggleMenu(true);
                }
            };
        }
    };

    // --- 6. FOOTER INTERACTIONS (Theme Lift, etc) ---
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

    // --- 7. GLOBAL ACCORDION LOGIC ---
    const initializeAccordions = () => {
        // We use event delegation on the document body
        // This handles clicks for existing AND future elements
        document.body.addEventListener('click', (e) => {
            const toggle = e.target.closest('.expand-toggle');

            if (toggle) {
                // Toggle the button state
                toggle.classList.toggle('active');

                // Find the content area (next sibling)
                const content = toggle.parentElement.querySelector('.expand-area');

                if (content) {
                    content.classList.toggle('open');
                }
            }
        });
    };

    // --- START ---
    loadComponents();
    initializeAccordions();
});

// --- GLOBAL HELPERS (Outside DOMContentLoaded) ---

// Sticky Header Logic
let resizeTimer;
const syncHeaderHeight = () => {
    const header = document.querySelector('.glass-nav');
    if (header) {
        document.documentElement.style.setProperty('--mobile-header-height', `${header.offsetHeight}px`);
    }
};

window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncHeaderHeight, 100);
});
window.addEventListener('orientationchange', syncHeaderHeight);

// Scroll Correction for Hash Links
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

window.addEventListener('load', () => {
    syncHeaderHeight();
    if (location.hash) {
        setTimeout(() => {
            const target = document.querySelector(location.hash);
            if (target) {
                const offset = getComputedStyle(document.documentElement).getPropertyValue('--mobile-header-height');
                const headerH = parseInt(offset) || 60;
                const top = target.getBoundingClientRect().top + window.scrollY - headerH - 10;
                window.scrollTo({ top: top, behavior: 'smooth' });
            }
        }, 100);
    }
});