(() => {
    "use strict";

    /* =========================================================
       HEMA REPOST CLEANER
       Enhanced Version
       ========================================================= */

    const PREFIX = "hema_repost_";
    const PANEL_ID = "hema-control-panel";

    const CONFIG = {
        initialWait: 2500,

        shareWait: 1200,

        successWait: 1800,

        minNextDelay: 2500,
        maxNextDelay: 5000,

        maxRetries: 3,
        retryDelay: 1800,

        elementTimeout: 10000,

        maxQueueSize: 500
    };

    /* =========================================================
       Helpers
       ========================================================= */

    const delay = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    function randomDelay(min, max) {
        return Math.floor(
            Math.random() * (max - min + 1) + min
        );
    }

    function log(...args) {
        console.log(
            "%c[HEMA REPOST CLEANER]",
            "color:#fe2c55;font-weight:bold;",
            ...args
        );
    }

    function normalizeText(text) {
        return String(text || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function isVisible(el) {
        if (!el) return false;

        const style = window.getComputedStyle(el);

        const rect = el.getBoundingClientRect();

        return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    /* =========================================================
       State Manager
       ========================================================= */

    function getState() {
        try {
            return {
                isRunning:
                    sessionStorage.getItem(
                        PREFIX + "isRunning"
                    ) === "true",

                targetCount:
                    parseInt(
                        sessionStorage.getItem(
                            PREFIX + "targetCount"
                        ) || "0",
                        10
                    ),

                deletedCount:
                    parseInt(
                        sessionStorage.getItem(
                            PREFIX + "deletedCount"
                        ) || "0",
                        10
                    ),

                failedCount:
                    parseInt(
                        sessionStorage.getItem(
                            PREFIX + "failedCount"
                        ) || "0",
                        10
                    ),

                currentIndex:
                    parseInt(
                        sessionStorage.getItem(
                            PREFIX + "currentIndex"
                        ) || "0",
                        10
                    ),

                queue: JSON.parse(
                    sessionStorage.getItem(
                        PREFIX + "queue"
                    ) || "[]"
                )
            };
        } catch (error) {
            console.warn(
                "[HEMA] State error:",
                error
            );

            return {
                isRunning: false,
                targetCount: 0,
                deletedCount: 0,
                failedCount: 0,
                currentIndex: 0,
                queue: []
            };
        }
    }

    function saveState(state) {
        sessionStorage.setItem(
            PREFIX + "isRunning",
            String(state.isRunning)
        );

        sessionStorage.setItem(
            PREFIX + "targetCount",
            String(state.targetCount)
        );

        sessionStorage.setItem(
            PREFIX + "deletedCount",
            String(state.deletedCount)
        );

        sessionStorage.setItem(
            PREFIX + "failedCount",
            String(state.failedCount)
        );

        sessionStorage.setItem(
            PREFIX + "currentIndex",
            String(state.currentIndex)
        );

        sessionStorage.setItem(
            PREFIX + "queue",
            JSON.stringify(state.queue)
        );
    }

    function clearState() {
        Object.keys(sessionStorage)
            .filter(key =>
                key.startsWith(PREFIX)
            )
            .forEach(key =>
                sessionStorage.removeItem(key)
            );
    }

    /* =========================================================
       Wait For Element
       ========================================================= */

    async function waitForElement(
        getter,
        timeout = CONFIG.elementTimeout
    ) {
        const start = Date.now();

        while (
            Date.now() - start <
            timeout
        ) {
            try {
                const element = getter();

                if (element) {
                    return element;
                }
            } catch (_) {}

            await delay(250);
        }

        return null;
    }

    /* =========================================================
       Find Share Button
       ========================================================= */

    function findShareButton() {
        const selectors = [
            'button[aria-label="Share"]',
            'button[aria-label="مشاركة"]',

            '[data-e2e="share-icon"]',
            '[data-e2e="browse-share"]',
            '[data-e2e="share-button"]'
        ];

        for (const selector of selectors) {
            const elements =
                Array.from(
                    document.querySelectorAll(
                        selector
                    )
                );

            const visible =
                elements.find(isVisible);

            if (visible) {
                return (
                    visible.closest(
                        "button,[role='button']"
                    ) || visible
                );
            }
        }

        /*
         * Fallback:
         * Search for Share / مشاركة text.
         */

        const elements =
            Array.from(
                document.querySelectorAll(
                    'button,[role="button"],div,span'
                )
            );

        for (const el of elements) {
            if (!isVisible(el)) continue;

            const text =
                normalizeText(
                    el.innerText ||
                    el.textContent
                );

            if (
                text === "share" ||
                text === "مشاركة"
            ) {
                return (
                    el.closest(
                        "button,[role='button']"
                    ) || el
                );
            }
        }

        /*
         * SVG fallback.
         */

        const svgs =
            Array.from(
                document.querySelectorAll(
                    "svg"
                )
            );

        for (const svg of svgs) {
            if (!isVisible(svg)) continue;

            const html =
                String(
                    svg.innerHTML || ""
                ).toLowerCase();

            if (
                html.includes("share") ||
                html.includes("arrow")
            ) {
                const parent =
                    svg.closest(
                        "button,[role='button']"
                    );

                if (
                    parent &&
                    isVisible(parent)
                ) {
                    return parent;
                }
            }
        }

        return null;
    }

    /* =========================================================
       Find Remove Repost
       ========================================================= */

    function findRemoveRepostButton() {
        const exactTexts = [
            "Remove repost",
            "إزالة إعادة النشر",
            "Remove reposts",
            "إزالة إعادة نشر"
        ];

        /*
         * 1. Selectors
         */

        const selectors = [
            '[data-e2e="remove-repost"]',

            'button[aria-label="Remove repost"]',
            'button[aria-label="إزالة إعادة النشر"]',

            '[role="menuitem"]',
            '[role="option"]'
        ];

        for (const selector of selectors) {
            const elements =
                Array.from(
                    document.querySelectorAll(
                        selector
                    )
                );

            for (const el of elements) {
                if (!isVisible(el)) continue;

                const text =
                    normalizeText(
                        el.innerText ||
                        el.textContent
                    );

                if (
                    exactTexts.some(
                        target =>
                            text ===
                            target.toLowerCase()
                    )
                ) {
                    return (
                        el.closest(
                            "button,[role='button'],[role='menuitem'],li"
                        ) || el
                    );
                }
            }
        }

        /*
         * 2. Search clickable elements
         */

        const clickable =
            Array.from(
                document.querySelectorAll(
                    'button,[role="button"],[role="menuitem"],li'
                )
            );

        for (const el of clickable) {
            if (!isVisible(el)) continue;

            const text =
                normalizeText(
                    el.innerText ||
                    el.textContent
                );

            if (
                exactTexts.some(
                    target =>
                        text ===
                        target.toLowerCase()
                )
            ) {
                return el;
            }
        }

        /*
         * 3. Search all elements
         */

        const all =
            Array.from(
                document.querySelectorAll(
                    "body *"
                )
            );

        for (const el of all) {
            if (!isVisible(el)) continue;

            const text =
                normalizeText(
                    el.textContent
                );

            if (
                exactTexts.some(
                    target =>
                        text ===
                        target.toLowerCase()
                )
            ) {
                const clickableParent =
                    el.closest(
                        'button,[role="button"],[role="menuitem"],li'
                    );

                if (
                    clickableParent &&
                    isVisible(clickableParent)
                ) {
                    return clickableParent;
                }

                return el;
            }
        }

        return null;
    }

    /* =========================================================
       Find Repost Button
       Used as additional verification
       ========================================================= */

    function findRepostButton() {
        const texts = [
            "Repost",
            "إعادة النشر"
        ];

        const elements =
            Array.from(
                document.querySelectorAll(
                    'button,[role="button"],div,span'
                )
            );

        for (const el of elements) {
            if (!isVisible(el)) continue;

            const text =
                normalizeText(
                    el.innerText ||
                    el.textContent
                );

            if (
                texts.some(
                    t =>
                        text ===
                        t.toLowerCase()
                )
            ) {
                return el;
            }
        }

        return null;
    }

    /* =========================================================
       Escape / Close Menu
       ========================================================= */

    async function pressEscape() {
        document.dispatchEvent(
            new KeyboardEvent(
                "keydown",
                {
                    key: "Escape",
                    code: "Escape",
                    keyCode: 27,
                    which: 27,
                    bubbles: true,
                    cancelable: true
                }
            )
        );

        await delay(300);
    }

    /* =========================================================
       Remove Current Repost
       ========================================================= */

    async function removeCurrentRepost() {
        log(
            "🔍 البحث عن زر Share..."
        );

        const shareBtn =
            await waitForElement(
                findShareButton,
                10000
            );

        if (!shareBtn) {
            throw new Error(
                "Share button not found"
            );
        }

        log(
            "✅ تم العثور على Share"
        );

        try {
            shareBtn.scrollIntoView({
                block: "center",
                inline: "center"
            });
        } catch (_) {}

        await delay(300);

        shareBtn.click();

        log(
            "📂 تم فتح قائمة المشاركة"
        );

        await delay(
            CONFIG.shareWait
        );

        /*
         * Search Remove repost
         */

        const removeBtn =
            await waitForElement(
                findRemoveRepostButton,
                8000
            );

        if (!removeBtn) {
            await pressEscape();

            throw new Error(
                "Remove repost button not found"
            );
        }

        log(
            "🗑️ تم العثور على Remove repost"
        );

        try {
            removeBtn.scrollIntoView({
                block: "center",
                inline: "center"
            });
        } catch (_) {}

        await delay(300);

        /*
         * Click
         */

        removeBtn.click();

        log(
            "🖱️ تم الضغط على Remove repost"
        );

        /*
         * Give TikTok time to process
         */

        await delay(
            CONFIG.successWait
        );

        /*
         * Verification #1:
         * Remove repost should disappear.
         */

        const start =
            Date.now();

        while (
            Date.now() - start <
            5000
        ) {
            const stillThere =
                findRemoveRepostButton();

            if (!stillThere) {
                log(
                    "✅ اختفى Remove repost"
                );

                return true;
            }

            await delay(300);
        }

        /*
         * Verification #2:
         * Menu/dialog may have closed completely.
         */

        const menus =
            Array.from(
                document.querySelectorAll(
                    '[role="menu"],[role="dialog"]'
                )
            ).filter(isVisible);

        if (menus.length === 0) {
            log(
                "✅ قائمة المشاركة أُغلقت"
            );

            return true;
        }

        /*
         * Verification #3:
         * Search for repost indicator.
         *
         * This is only an additional check.
         */

        const repostIndicator =
            findRepostButton();

        if (repostIndicator) {
            log(
                "ℹ️ تم العثور على حالة Repost بعد العملية"
            );

            /*
             * Don't immediately fail here because
             * TikTok's DOM can contain hidden/stale
             * elements.
             */
        }

        await pressEscape();

        throw new Error(
            "Could not verify repost removal"
        );
    }

    /* =========================================================
       Retry System
       ========================================================= */

    async function processWithRetry() {
        for (
            let attempt = 1;
            attempt <= CONFIG.maxRetries;
            attempt++
        ) {
            try {
                log(
                    `🔄 محاولة ${attempt}/${CONFIG.maxRetries}`
                );

                const success =
                    await removeCurrentRepost();

                if (success) {
                    log(
                        "🎉 العملية نجحت"
                    );

                    return true;
                }

            } catch (error) {
                console.warn(
                    `[HEMA] محاولة ${attempt} فشلت:`,
                    error.message
                );

                if (
                    attempt <
                    CONFIG.maxRetries
                ) {
                    log(
                        `⏳ إعادة المحاولة بعد ${CONFIG.retryDelay}ms`
                    );

                    await pressEscape();

                    await delay(
                        CONFIG.retryDelay
                    );
                }
            }
        }

        return false;
    }

    /* =========================================================
       Collect Video Links
       ========================================================= */

    function collectVideoLinks() {
        const links =
            Array.from(
                document.querySelectorAll(
                    "a[href]"
                )
            )
                .map(a => a.href)
                .filter(href => {
                    try {
                        const url =
                            new URL(href);

                        return (
                            url.pathname.includes(
                                "/video/"
                            )
                        );
                    } catch (_) {
                        return false;
                    }
                });

        return [
            ...new Set(links)
        ];
    }

    /* =========================================================
       Control Panel
       ========================================================= */

    function createControlPanel() {
        if (!document.body) return;

        const state =
            getState();

        let panel =
            document.getElementById(
                PANEL_ID
            );

        if (!panel) {
            panel =
                document.createElement(
                    "div"
                );

            panel.id =
                PANEL_ID;

            Object.assign(
                panel.style,
                {
                    position: "fixed",

                    top: "70px",

                    right: "15px",

                    zIndex:
                        "2147483647",

                    background:
                        "rgba(18,18,18,.97)",

                    color: "#fff",

                    border:
                        "2px solid #fe2c55",

                    borderRadius:
                        "14px",

                    padding: "15px",

                    fontFamily:
                        "Arial,sans-serif",

                    boxShadow:
                        "0 8px 25px rgba(0,0,0,.65)",

                    width: "230px",

                    textAlign: "center",

                    direction: "rtl",

                    backdropFilter:
                        "blur(8px)",

                    boxSizing:
                        "border-box"
                }
            );

            document.body.appendChild(
                panel
            );
        }

        /*
         * START SCREEN
         */

        if (!state.isRunning) {
            panel.innerHTML = `
                <h4 style="
                    margin:0 0 8px;
                    color:#fe2c55;
                ">
                    🧹 تنظيف الريبوست
                </h4>

                <p style="
                    font-size:11px;
                    color:#bbb;
                    margin:0 0 12px;
                ">
                    افتح قسم الريبوست أولاً
                </p>

                <label style="
                    display:block;
                    font-size:12px;
                    margin-bottom:6px;
                ">
                    عدد الريبوست:
                </label>

                <input
                    id="hema-target-count"
                    type="number"
                    min="1"
                    max="${CONFIG.maxQueueSize}"
                    value="10"
                    style="
                        box-sizing:border-box;
                        width:100%;
                        padding:9px;
                        margin-bottom:10px;
                        text-align:center;
                        border-radius:7px;
                        border:1px solid #444;
                        background:#222;
                        color:#fff;
                        font-weight:bold;
                        outline:none;
                    "
                >

                <button
                    id="hema-start"
                    style="
                        width:100%;
                        padding:10px;
                        border:0;
                        border-radius:7px;
                        background:#fe2c55;
                        color:#fff;
                        font-weight:bold;
                        cursor:pointer;
                    "
                >
                    🚀 ابدأ التنظيف
                </button>

                <div style="
                    margin-top:10px;
                    font-size:9px;
                    color:#777;
                ">
                    HEMA Repost Cleaner
                </div>
            `;

            const startBtn =
                document.getElementById(
                    "hema-start"
                );

            if (startBtn) {
                startBtn.onclick =
                    startCleaner;
            }

            return;
        }

        /*
         * RUNNING SCREEN
         */

        const progress =
            state.targetCount > 0
                ? Math.round(
                    (
                        state.deletedCount /
                        state.targetCount
                    ) * 100
                )
                : 0;

        panel.innerHTML = `
            <h4 style="
                margin:0 0 10px;
                color:#00f2fe;
            ">
                ⚙️ جاري التنظيف
            </h4>

            <div style="
                font-size:13px;
                margin-bottom:8px;
            ">
                تم حذف:
                <b style="
                    color:#fe2c55;
                    font-size:20px;
                ">
                    ${state.deletedCount}
                </b>
                /
                ${state.targetCount}
            </div>

            <div style="
                background:#333;
                height:7px;
                border-radius:10px;
                overflow:hidden;
                margin-bottom:10px;
            ">
                <div style="
                    width:${Math.min(
                        progress,
                        100
                    )}%;
                    height:100%;
                    background:#fe2c55;
                    transition:width .3s;
                "></div>
            </div>

            <div style="
                font-size:11px;
                color:#aaa;
                margin-bottom:10px;
                line-height:1.8;
            ">
                التقدم: ${progress}%
                <br>
                فشل: ${state.failedCount}
                <br>
                متبقي: ${
                    Math.max(
                        0,
                        state.targetCount -
                        state.deletedCount
                    )
                }
            </div>

            <button
                id="hema-stop"
                style="
                    width:100%;
                    padding:10px;
                    border:0;
                    border-radius:7px;
                    background:#555;
                    color:#fff;
                    font-weight:bold;
                    cursor:pointer;
                "
            >
                🛑 إيقاف
            </button>
        `;

        const stopBtn =
            document.getElementById(
                "hema-stop"
            );

        if (stopBtn) {
            stopBtn.onclick =
                stopCleaner;
        }
    }

    /* =========================================================
       Start Cleaner
       ========================================================= */

    function startCleaner() {
        const input =
            document.getElementById(
                "hema-target-count"
            );

        let target =
            parseInt(
                input?.value || "0",
                10
            );

        if (
            Number.isNaN(target) ||
            target <= 0
        ) {
            alert(
                "⚠️ اكتب رقم صحيح."
            );

            return;
        }

        if (
            target >
            CONFIG.maxQueueSize
        ) {
            target =
                CONFIG.maxQueueSize;
        }

        let links =
            collectVideoLinks();

        if (!links.length) {
            alert(
                "⚠️ لم أجد أي فيديوهات.\n\nافتح قسم الريبوست وحمّل الفيديوهات المطلوبة على الشاشة أولاً."
            );

            return;
        }

        if (
            target >
            links.length
        ) {
            alert(
                `⚠️ طلبت حذف ${target}، لكن الموجود حاليًا ${links.length} فقط.\n\nسيتم استخدام ${links.length} فيديو.`
            );

            target =
                links.length;
        }

        links =
            links.slice(
                0,
                target
            );

        const state = {
            isRunning: true,

            targetCount:
                target,

            deletedCount:
                0,

            failedCount:
                0,

            currentIndex:
                0,

            queue:
                links
        };

        saveState(state);

        log(
            "🚀 Cleaner started",
            state
        );

        createControlPanel();

        /*
         * Open first video
         */

        window.location.href =
            state.queue[0];
    }

    /* =========================================================
       Stop Cleaner
       ========================================================= */

    function stopCleaner() {
        clearState();

        log(
            "🛑 Cleaner stopped"
        );

        alert(
            "🛑 تم إيقاف الأداة."
        );

        location.reload();
    }

    /* =========================================================
       Finish Cleaner
       ========================================================= */

    function finishCleaner(state) {
        const deleted =
            state.deletedCount;

        const failed =
            state.failedCount;

        clearState();

        log(
            "🎉 Finished",
            {
                deleted,
                failed
            }
        );

        alert(
            `🎉 انتهت العملية!\n\nتم حذف: ${deleted}\nفشل: ${failed}`
        );

        createControlPanel();
    }

    /* =========================================================
       Main Queue
       ========================================================= */

    async function processQueue() {
        let state =
            getState();

        if (!state.isRunning) {
            return;
        }

        if (
            !state.queue.length ||
            state.deletedCount >=
                state.targetCount
        ) {
            finishCleaner(state);
            return;
        }

        log(
            `📹 الفيديو الحالي: ${state.currentIndex + 1}/${state.targetCount}`
        );

        log(
            "🔗",
            state.queue[0]
        );

        /*
         * Wait for TikTok page
         */

        await delay(
            CONFIG.initialWait
        );

        /*
         * Check state again
         * because user may have stopped it.
         */

        state =
            getState();

        if (!state.isRunning) {
            return;
        }

        /*
         * Process current video
         */

        const success =
            await processWithRetry();

        /*
         * Get latest state
         */

        state =
            getState();

        if (success) {
            state.deletedCount++;

            log(
                `✅ تم الحذف بنجاح: ${state.deletedCount}/${state.targetCount}`
            );
        } else {
            state.failedCount++;

            log(
                `❌ فشل الفيديو الحالي. عدد الفشل: ${state.failedCount}`
            );
        }

        /*
         * Important:
         *
         * Remove current item only AFTER
         * processing/retries have finished.
         */

        state.queue.shift();

        state.currentIndex++;

        saveState(state);

        createControlPanel();

        /*
         * Finished?
         */

        if (
            state.queue.length === 0 ||
            state.deletedCount >=
                state.targetCount
        ) {
            finishCleaner(state);
            return;
        }

        /*
         * Wait before next video
         */

        const wait =
            randomDelay(
                CONFIG.minNextDelay,
                CONFIG.maxNextDelay
            );

        log(
            `⏳ الانتقال للفيديو التالي بعد ${wait}ms`
        );

        await delay(wait);

        /*
         * Get latest state
         */

        state =
            getState();

        if (!state.isRunning) {
            return;
        }

        if (
            state.queue.length > 0
        ) {
            log(
                "➡️ الانتقال للفيديو التالي"
            );

            window.location.href =
                state.queue[0];
        }
    }

    /* =========================================================
       Initialize
       ========================================================= */

    function init() {
        createControlPanel();

        const state =
            getState();

        if (state.isRunning) {
            log(
                "🔄 استئناف العملية..."
            );

            setTimeout(
                processQueue,
                1000
            );
        }
    }

    /* =========================================================
       DOM Ready
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );
    } else {
        init();
    }

    /* =========================================================
       Panel Sync
       ========================================================= */

    setInterval(() => {
        const panel =
            document.getElementById(
                PANEL_ID
            );

        if (panel) {
            createControlPanel();
        }
    }, 2000);

})();
