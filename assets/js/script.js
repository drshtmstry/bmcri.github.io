document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // 1. BASE URL CALCULATION
    const cssLink = document.querySelector('link[href*="style.css"]');
    const baseUrl = cssLink ? cssLink.getAttribute("href").split("assets/css/style.css")[0] || "./" : "./";
    console.log("Base URL:", baseUrl);

    // 2. HELPER: FIX RELATIVE LINKS
    const fixRelativeLinks = () => {
        const elementsToFix = document.querySelectorAll('#global-header a[href], #global-footer a[href], #global-header img[src], #global-footer img[src]');

        elementsToFix.forEach(element => {
            const attributeName = element.tagName === 'IMG' ? 'src' : 'href';
            const currentValue = element.getAttribute(attributeName);

            if (!currentValue || /^(http|\/\/|mailto:|tel:|#|data:)/.test(currentValue)) return;

            let cleanPath = currentValue.replace(/^(\.?\/)/, '');
            while (cleanPath.startsWith('../')) {
                cleanPath = cleanPath.substring(3);
            }

            element.setAttribute(attributeName, baseUrl + cleanPath);
        });
    };

    // 3. SCROLL REVEAL ANIMATION
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    setTimeout(() => {
        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }, 100);

    // 4. SLIDESHOW LOGIC
    const initializeSlideshow = async () => {
        const slideshowContainer = document.getElementById("dynamic-slideshow");
        if (!slideshowContainer) return;

        const runSlideshow = () => {
            const slides = slideshowContainer.querySelectorAll(".hero-slide");
            if (!slides.length) return;

            let currentIndex = 0;
            let slideInterval;

            const showSlide = (newIndex) => {
                slides[currentIndex].classList.remove("active");
                currentIndex = (newIndex + slides.length) % slides.length;
                slides[currentIndex].classList.add("active");
            };

            const startAutoPlay = () => {
                slideInterval = setInterval(() => showSlide(currentIndex + 1), 5000);
            };

            const resetAutoPlay = () => {
                clearInterval(slideInterval);
                startAutoPlay();
            };

            const nextBtn = slideshowContainer.querySelector(".next");
            const prevBtn = slideshowContainer.querySelector(".prev");

            if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); showSlide(currentIndex + 1); resetAutoPlay(); };
            if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); showSlide(currentIndex - 1); resetAutoPlay(); };

            startAutoPlay();
        };

        try {
            const response = await fetch(baseUrl + "assets/slideshow/slideshow.json");
            if (!response.ok) throw new Error("Failed to load slideshow JSON");
            let images = await response.json();
            for (let i = images.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [images[i], images[j]] = [images[j], images[i]];
            }
            const overlay = slideshowContainer.querySelector(".slide-overlay");
            images.forEach((src, index) => {
                const slideDiv = document.createElement("div");
                slideDiv.className = `hero-slide ${index === 0 ? "active" : ""}`;
                slideDiv.innerHTML = `<img src="${baseUrl}assets/slideshow/${src}" alt="Slide" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>`;
                slideshowContainer.insertBefore(slideDiv, overlay);
            });
            runSlideshow();
        } catch (error) {
            console.warn("Slideshow Error:", error);
            runSlideshow();
        }
    };

    // 5. COMPONENT LOADER
    const loadComponents = async () => {
        const fetchHtml = (file) => fetch(baseUrl + file).then(res => res.ok ? res.text() : null);

        // Identify the main content area
        const mainContentArea = document.getElementById("main-content-area");

        // Determine if we need to load homepage content (only if main area exists and is empty)
        const needsMainContent = mainContentArea && !mainContentArea.innerHTML.trim();

        // Start all fetches in parallel
        const headerPromise = fetchHtml('header.html');
        const footerPromise = fetchHtml('footer.html');
        const homepagePromise = needsMainContent ? fetchHtml('homepage.html') : Promise.resolve(null);

        try {
            // Wait for ALL data to arrive before rendering anything
            const [headerHtml, footerHtml, homepageHtml] = await Promise.all([
                headerPromise,
                footerPromise,
                homepagePromise
            ]);

            // 1. Inject Header
            if (headerHtml) {
                document.getElementById('global-header').innerHTML = headerHtml;
                fixRelativeLinks();
                initializeNavigation();
            }

            // 2. Inject Main Content
            if (homepageHtml && mainContentArea) {
                mainContentArea.innerHTML = homepageHtml;
                fixRelativeLinks();
                // Initialize homepage-specific observers/scripts
                document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
                initializeSlideshow();
            }

            // 3. Inject Footer (Now guaranteed to be after content)
            if (footerHtml) {
                document.getElementById('global-footer').innerHTML = footerHtml;
                fixRelativeLinks();
                const yearSpan = document.getElementById("current-year");
                if (yearSpan) yearSpan.textContent = new Date().getFullYear();

                // 4. Auto-lift Theme Toggle over Footer
                const copyrightBar = document.querySelector('.copyright-bar');
                const themeBtn = document.getElementById('theme-toggle');

                if (copyrightBar && themeBtn) {
                    const footerObserver = new IntersectionObserver((entries) => {
                        const entry = entries[0];
                        // If copyright bar is visible, add 'lift-up' class
                        if (entry.isIntersecting) {
                            themeBtn.classList.add('lift-up');
                        } else {
                            themeBtn.classList.remove('lift-up');
                        }
                    }, {
                        root: null,
                        threshold: 0.1
                    });

                    footerObserver.observe(copyrightBar);
                }

            }

        } catch (error) {
            console.error("Error loading components:", error);
        }
    };

    // 6. NAVIGATION LOGIC
    const initializeNavigation = () => {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';

        document.querySelectorAll(".nav-list a").forEach(link => {
            const linkHref = link.getAttribute("href");
            const linkFile = linkHref ? linkHref.split('/').pop() : '';

            if (linkFile === currentPath) {
                link.classList.add("active");

                const parentSubmenu = link.closest(".has-submenu");
                if (parentSubmenu) {
                    const submenuTrigger = parentSubmenu.querySelector(":scope > a");
                    if (submenuTrigger) submenuTrigger.classList.add("active");
                }
                const mainNavItem = link.closest(".nav-item");
                if (mainNavItem) {
                    const mainNavTrigger = mainNavItem.querySelector(".nav-link");
                    if (mainNavTrigger) mainNavTrigger.classList.add("active");
                }
            }
        });

        const menuBtn = document.querySelector(".mobile-menu-toggle");
        const navList = document.querySelector(".nav-list");
        const sidebarOverlay = document.getElementById("sidebar-overlay");

        if (menuBtn && navList) {
            const toggleMenu = (forceClose) => {
                const isActive = forceClose ? false : !navList.classList.contains("active");

                // Toggle classes immediately so animation starts
                navList.classList.toggle("active", isActive);
                menuBtn.classList.toggle("active", isActive);
                if (sidebarOverlay) sidebarOverlay.classList.toggle("active", isActive);

                // Handle Body Scroll Smoothly
                if (isActive) {
                    // LOCK immediately when opening
                    document.body.style.overflow = "hidden";
                } else {
                    // UNLOCK after animation ends (300ms matches mobile.css transition)
                    setTimeout(() => {
                        // Double-check sidebar is still closed before unlocking
                        // (Prevents bugs if user clicks open/close very fast)
                        if (!navList.classList.contains("active")) {
                            document.body.style.overflow = "";
                        }
                    }, 300);
                }
            };

            menuBtn.onclick = (e) => { e.stopPropagation(); toggleMenu(); };
            if (sidebarOverlay) sidebarOverlay.onclick = () => toggleMenu(true);

            navList.onclick = (e) => {
                const link = e.target.closest("a");
                if (!link) return;

                // Don't close sidebar when clicking Theme Toggle
                if (link.id === "mobile-theme-toggle") return;

                const nextSibling = link.nextElementSibling;
                if (nextSibling && (nextSibling.matches('.dropdown-menu') || nextSibling.matches('.dropdown-submenu'))) {
                    e.preventDefault();
                    e.stopPropagation();
                    link.parentElement.classList.toggle("dropdown-active");
                } else {
                    // Close sidebar for normal links
                    toggleMenu(true);
                }
            };
        }
    };

    loadComponents();
});

/* Sticky header scroll correction */

if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

function getHeaderHeight() {
    const header = document.querySelector('.glass-nav');
    return header ? header.offsetHeight : 0;
}

function syncHeaderHeight() {
    const height = getHeaderHeight();
    document.documentElement.style.setProperty(
        '--mobile-header-height',
        height + 'px'
    );
}

let scrollAdjusted = false;

window.addEventListener('load', () => {
    if (scrollAdjusted) return;
    scrollAdjusted = true;

    syncHeaderHeight();
    const headerHeight = getHeaderHeight();

    if (location.hash) {
        const target = document.querySelector(location.hash);
        if (target) {
            const y =
                target.getBoundingClientRect().top +
                window.scrollY -
                headerHeight -
                8;

            window.scrollTo(0, Math.max(0, y));
        }
    }
});

window.addEventListener('resize', syncHeaderHeight);
window.addEventListener('orientationchange', syncHeaderHeight);
