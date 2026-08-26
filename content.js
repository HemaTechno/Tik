(() => {
    "use strict";

    /* =========================================================
       HEMA REPOST CLEANER - Enhanced Version
       ========================================================= */

    const PREFIX = "hema_repost_";
    const PANEL_ID = "hema-control-panel";

    const CONFIG = {
        initialWait: 2500,
        actionWait: 1000,
        successWait: 1500,

        minNextDelay: 2500,
        maxNextDelay: 5000,

        maxRetries: 3,
        retryDelay: 1800,

        elementTimeout: 7000,

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

    function getState() {
        try {
            return {
                isRunning:
                    sessionStorage.getItem(PREFIX + "isRunning") === "true",

                targetCount:
                    parseInt(
                        sessionStorage.getItem(PREFIX + "targetCount") || "0",
                        10
                    ),

                deletedCount:
                    parseInt(
                        sessionStorage.getItem(PREFIX + "deletedCount") || "0",
                        10
                    ),

                failedCount:
                    parseInt(
                        sessionStorage.getItem(PREFIX + "failedCount") || "0",
                        10
                    ),

                currentIndex:
                    parseInt(
                        sessionStorage.getItem(PREFIX + "currentIndex") || "0",
                        10
                    ),

                queue: JSON.parse(
                    sessionStorage.getItem(PREFIX + "queue") || "[]"
                )
            };
        } catch (e) {
            console.warn("[HEMA] State error:", e);

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
            .filter(key => key.startsWith(PREFIX))
            .forEach(key => sessionStorage.removeItem(key));
    }

    function log(...args) {
        console.log(
            "%c[HEMA REPOST CLEANER]",
            "color:#fe2c55;font-weight:bold;",
            ...args
        );
    }

    /* =========================================================
       Wait for element
       ========================================================= */

    async function waitForElement(getter, timeout = CONFIG.elementTimeout) {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            try {
                const element = getter();

                if (element) {
                    return element;
                }
            } catch (_) {}

            await delay(300);
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
            const element = document.querySelector(selector);

            if (element) {
                return element.closest("button") || element;
            }
        }

        /* Fallback based on accessible text */

        const elements = Array.from(
            document.querySelectorAll(
                'button,[role="button"],div,span'
            )
        );

        const found = elements.find(el => {
            const text = (el.innerText || "").trim().toLowerCase();

            return (
                text === "share" ||
                text === "مشاركة"
            );
        });

        if (found) {
            return found.closest("button,[role='button']") || found;
        }

        return null;
    }

    /* =========================================================
       Find Remove Repost Button
       ========================================================= */

    function findRemoveRepostButton() {
        const selectors = [
            '[data-e2e="remove-repost"]',
            'button[aria-label="Remove repost"]',
            'button[aria-label="إزالة إعادة النشر"]'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);

            if (element) {
                return element.closest("button") || element;
            }
        }

        const elements = Array.from(
            document.querySelectorAll(
                'button,[role="button"],span,div,p'
            )
        );

        const texts = [
            "إزالة إعادة النشر",
            "remove repost",
            "remove reposts",
            "إزالة إعادة نشر"
        ];

        const found = elements.find(el => {
            const text = (el.innerText || "")
                .trim()
                .toLowerCase();

            return texts.some(t =>
                text === t.toLowerCase()
            );
        });

        if (found) {
            return (
                found.closest(
                    "button,[role='button']"
                ) || found
            );
        }

        return null;
    }

    /* =========================================================
       Close menus / overlays
       ========================================================= */

    async function pressEscape() {
        document.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Escape",
                code: "Escape",
                bubbles: true
            })
        );

        await delay(300);
    }

    /* =========================================================
       Process current video
       ========================================================= */

    async function removeCurrentRepost() {
        log("Searching for Share button...");

        const shareBtn = await waitForElement(
            findShareButton,
            CONFIG.elementTimeout
        );

        if (!shareBtn) {
            throw new Error("Share button not found");
        }

        log("Share button found.");

        shareBtn.click();

        await delay(CONFIG.actionWait);

        log("Searching for Remove Repost...");

        const removeBtn = await waitForElement(
            findRemoveRepostButton,
            CONFIG.elementTimeout
        );

        if (!removeBtn) {
            await pressEscape();

            throw new Error(
                "Remove Repost button not found"
            );
        }

        log("Remove Repost found.");

        removeBtn.click();

        await delay(CONFIG.successWait);

        /*
         * Try to verify that Remove Repost disappeared.
         * This isn't perfect because TikTok UI can change,
         * but it gives us an additional success check.
         */

        const stillExists = findRemoveRepostButton();

        if (stillExists) {
            log(
                "Remove Repost still exists. " +
                "Assuming operation may have failed."
            );

            await pressEscape();

            throw new Error(
                "Could not verify repost removal"
            );
        }

        return true;
    }

    /* =========================================================
       Process with Retry
       ========================================================= */

    async function processWithRetry() {
        for (
            let attempt = 1;
            attempt <= CONFIG.maxRetries;
            attempt++
        ) {
            try {
                log(
                    `Attempt ${attempt}/${CONFIG.maxRetries}`
                );

                const success =
                    await removeCurrentRepost();

                if (success) {
                    return true;
                }

            } catch (error) {
                console.warn(
                    `[HEMA] Attempt ${attempt} failed:`,
                    error.message
                );

                if (
                    attempt <
                    CONFIG.maxRetries
                ) {
                    await delay(
                        CONFIG.retryDelay
                    );

                    /*
                     * Sometimes the menu remains open.
                     */

                    await pressEscape();
                }
            }
        }

        return false;
    }

    /* =========================================================
       Get Video Links
       ========================================================= */

    function collectVideoLinks() {
        const links = Array.from(
            document.querySelectorAll("a[href]")
        )
            .map(a => a.href)
            .filter(href => {
                try {
                    const url = new URL(href);

                    return (
                        url.pathname.includes("/video/")
                    );
                } catch (_) {
                    return false;
                }
            });

        return [...new Set(links)];
    }

    /* =========================================================
       Control Panel
       ========================================================= */

    function createControlPanel() {
        if (!document.body) return;

        let panel =
            document.getElementById(PANEL_ID);

        const state = getState();

        if (!panel) {
            panel = document.createElement("div");

            panel.id = PANEL_ID;

            Object.assign(panel.style, {
                position: "fixed",
                top: "70px",
                right: "15px",
                zIndex: "2147483647",
                background:
                    "rgba(18,18,18,.97)",
                color: "#fff",
                border:
                    "2px solid #fe2c55",
                borderRadius: "14px",
                padding: "15px",
                fontFamily:
                    "Arial,sans-serif",
                boxShadow:
                    "0 8px 25px rgba(0,0,0,.65)",
                width: "230px",
                textAlign: "center",
                direction: "rtl",
                backdropFilter:
                    "blur(8px)"
            });

            document.body.appendChild(panel);
        }

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
                    🚀 ابدأ
                </button>

                <div style="
                    margin-top:10px;
                    font-size:10px;
                    color:#888;
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

        } else {
            const progress =
                state.targetCount > 0
                    ? Math.round(
                        (state.deletedCount /
                            state.targetCount) *
                        100
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
                    / ${state.targetCount}
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
                ">
                    التقدم: ${progress}%
                    <br>
                    فشل: ${state.failedCount}
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
    }

    /* =========================================================
       Start
       ========================================================= */

    function startCleaner() {
        const input =
            document.getElementById(
                "hema-target-count"
            );

        let target =
            parseInt(input?.value || "0", 10);

        if (
            Number.isNaN(target) ||
            target <= 0
        ) {
            alert("⚠️ اكتب رقم صحيح.");
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
                "⚠️ لم أجد فيديوهات. افتح قسم الريبوست وحمّل الفيديوهات المطلوبة على الشاشة."
            );

            return;
        }

        if (target > links.length) {
            alert(
                `⚠️ المطلوب ${target} فيديو، لكن المتاح حالياً ${links.length} فقط.`
            );

            target = links.length;
        }

        links = links.slice(0, target);

        const state = {
            isRunning: true,
            targetCount: target,
            deletedCount: 0,
            failedCount: 0,
            currentIndex: 0,
            queue: links
        };

        saveState(state);

        log(
            "Cleaner started.",
            state
        );

        createControlPanel();

        window.location.href =
            state.queue[0];
    }

    /* =========================================================
       Stop
       ========================================================= */

    function stopCleaner() {
        clearState();

        log("Cleaner stopped.");

        alert("🛑 تم إيقاف الأداة.");

        location.reload();
    }

    /* =========================================================
       Main Queue
       ========================================================= */

    async function processQueue() {
        const state = getState();

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

        await delay(
            CONFIG.initialWait
        );

        const currentUrl =
            state.queue[0];

        log(
            "Processing:",
            currentUrl
        );

        const success =
            await processWithRetry();

        const newState = getState();

        if (success) {
            newState.deletedCount++;

            log(
                `Success: ${newState.deletedCount}/${newState.targetCount}`
            );
        } else {
            newState.failedCount++;

            log(
                "Failed after retries."
            );
        }

        /*
         * Remove current item only after processing
         * has finished.
         */

        newState.queue.shift();

        newState.currentIndex++;

        saveState(newState);

        createControlPanel();

        /*
         * Completed?
         */

        if (
            newState.queue.length === 0 ||
            newState.deletedCount >=
                newState.targetCount
        ) {
            finishCleaner(newState);
            return;
        }

        /*
         * Random delay before next video.
         */

        const wait =
            randomDelay(
                CONFIG.minNextDelay,
                CONFIG.maxNextDelay
            );

        log(
            `Next video in ${wait}ms`
        );

        await delay(wait);

        const latestState =
            getState();

        if (
            !latestState.isRunning
        ) {
            return;
        }

        if (
            latestState.queue.length
        ) {
            window.location.href =
                latestState.queue[0];
        }
    }

    /* =========================================================
       Finish
       ========================================================= */

    function finishCleaner(state) {
        clearState();

        log(
            "Finished.",
            state
        );

        alert(
            `🎉 انتهت العملية!\n\nتم حذف: ${state.deletedCount}\nفشل: ${state.failedCount}`
        );

        createControlPanel();
    }

    /* =========================================================
       Initialize
       ========================================================= */

    function init() {
        createControlPanel();

        const state =
            getState();

        if (state.isRunning) {
            setTimeout(
                processQueue,
                1000
            );
        }
    }

    /*
     * Create panel after DOM is ready
     */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            init,
            { once: true }
        );
    } else {
        init();
    }

    /*
     * Keep panel synchronized without
     * rebuilding it every 1.5 seconds.
     */

    setInterval(() => {
        if (
            document.getElementById(
                PANEL_ID
            )
        ) {
            createControlPanel();
        }
    }, 2000);

})();
