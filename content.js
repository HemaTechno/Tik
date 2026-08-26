(() => {
    "use strict";

    /* =========================================================
       HEMA REPOST CLEANER
       Full Enhanced & Optimized Version
       ========================================================= */

    const PREFIX = "hema_repost_";
    const PANEL_ID = "hema-control-panel";

    const CONFIG = {
        initialWait: 2500,     // انتظار تحميل صفحة الفيديو
        shareWait: 1200,       // انتظار فتح قائمة Share
        successWait: 1000,     // انتظار بعد الضغط على Remove repost
        minNextDelay: 2500,    // أقل انتظار بين الفيديوهات
        maxNextDelay: 5000,    // أقصى انتظار بين الفيديوهات
        maxRetries: 3,         // عدد محاولات معالجة الفيديو
        retryDelay: 1800,      // الانتظار بين المحاولات
        elementTimeout: 10000, // أقصى وقت للبحث عن عنصر
        maxQueueSize: 500      // أقصى عدد فيديوهات
    };

    /* =========================================================
       Helpers
       ========================================================= */

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    function randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    function log(...args) {
        console.log("%c[HEMA REPOST CLEANER]", "color:#fe2c55;font-weight:bold;", ...args);
    }

    function normalizeText(text) {
        return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
    }

    function isVisible(el) {
        if (!el) return false;
        try {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0" &&
                rect.width > 0 &&
                rect.height > 0
            );
        } catch (_) {
            return false;
        }
    }

    /* =========================================================
       State Manager
       ========================================================= */

    function getState() {
        try {
            let queue = [];
            try {
                queue = JSON.parse(sessionStorage.getItem(PREFIX + "queue") || "[]");
            } catch (_) {
                queue = [];
            }

            return {
                isRunning: sessionStorage.getItem(PREFIX + "isRunning") === "true",
                targetCount: parseInt(sessionStorage.getItem(PREFIX + "targetCount") || "0", 10),
                deletedCount: parseInt(sessionStorage.getItem(PREFIX + "deletedCount") || "0", 10),
                failedCount: parseInt(sessionStorage.getItem(PREFIX + "failedCount") || "0", 10),
                currentIndex: parseInt(sessionStorage.getItem(PREFIX + "currentIndex") || "0", 10),
                queue
            };
        } catch (error) {
            console.warn("[HEMA] State error:", error);
            return {
                isRunning: false, targetCount: 0, deletedCount: 0,
                failedCount: 0, currentIndex: 0, queue: []
            };
        }
    }

    function saveState(state) {
        sessionStorage.setItem(PREFIX + "isRunning", String(state.isRunning));
        sessionStorage.setItem(PREFIX + "targetCount", String(state.targetCount));
        sessionStorage.setItem(PREFIX + "deletedCount", String(state.deletedCount));
        sessionStorage.setItem(PREFIX + "failedCount", String(state.failedCount));
        sessionStorage.setItem(PREFIX + "currentIndex", String(state.currentIndex));
        sessionStorage.setItem(PREFIX + "queue", JSON.stringify(state.queue));
    }

    function clearState() {
        Object.keys(sessionStorage)
            .filter(key => key.startsWith(PREFIX))
            .forEach(key => sessionStorage.removeItem(key));
    }

    /* =========================================================
       Wait For Element
       ========================================================= */

    async function waitForElement(getter, timeout = CONFIG.elementTimeout) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const element = getter();
                if (element) return element;
            } catch (_) {}
            await delay(250);
        }
        return null;
    }

    /* =========================================================
       Find Elements (Share & Remove)
       ========================================================= */

    function findShareButton() {
        const selectors = [
            'button[aria-label="Share"]', 'button[aria-label="مشاركة"]',
            '[data-e2e="share-icon"]', '[data-e2e="browse-share"]', '[data-e2e="share-button"]'
        ];

        for (const selector of selectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            for (const element of elements) {
                if (isVisible(element)) return element.closest("button,[role='button']") || element;
            }
        }

        const elements = Array.from(document.querySelectorAll('button,[role="button"],div,span'));
        for (const element of elements) {
            if (!isVisible(element)) continue;
            const text = normalizeText(element.innerText || element.textContent);
            if (text === "share" || text === "مشاركة") {
                return element.closest("button,[role='button']") || element;
            }
        }
        return null;
    }

    function findRemoveRepostButton() {
        const exactTexts = ["remove repost", "إزالة إعادة النشر", "remove reposts", "إزالة إعادة نشر"];
        const selectors = [
            '[data-e2e="remove-repost"]', 'button[aria-label="Remove repost"]', 'button[aria-label="إزالة إعادة النشر"]'
        ];

        for (const selector of selectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            for (const element of elements) {
                if (!isVisible(element)) continue;
                const text = normalizeText(element.innerText || element.textContent);
                if (exactTexts.some(target => text === target)) {
                    return element.closest("button,[role='button'],[role='menuitem'],li") || element;
                }
            }
        }

        const allElements = Array.from(document.querySelectorAll("body *"));
        for (const element of allElements) {
            if (!isVisible(element)) continue;
            const text = normalizeText(element.textContent);
            if (exactTexts.some(target => text === target)) {
                const parent = element.closest('button,[role="button"],[role="menuitem"],li');
                if (parent && isVisible(parent)) return parent;
                return element;
            }
        }
        return null;
    }

    /* =========================================================
       UI & Actions Verification
       ========================================================= */

    async function pressEscape() {
        try {
            document.dispatchEvent(new KeyboardEvent("keydown", {
                key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true
            }));
        } catch (_) {}
        await delay(350);
    }

    function hasVisibleShareMenu() {
        return Array.from(document.querySelectorAll('[role="menu"],[role="dialog"]')).some(isVisible);
    }

    async function verifyRemoval() {
        log("🔎 بدء التحقق من نجاح العملية...");
        const start = Date.now();

        while (Date.now() - start < 6000) {
            if (!findRemoveRepostButton()) {
                log("✅ Remove repost اختفى");
                return true;
            }
            if (!hasVisibleShareMenu()) {
                log("✅ قائمة المشاركة أُغلقت");
                return true;
            }
            await delay(350);
        }

        log("🔄 التحقق مرة ثانية عن طريق إعادة فتح Share...");
        await pressEscape();
        await delay(700);

        if (!findShareButton()) await delay(800);
        const shareButton = findShareButton();
        
        if (!shareButton) throw new Error("Share button unavailable during verification");
        shareButton.click();
        log("📂 تم فتح Share للتحقق");
        await delay(900);

        if (!findRemoveRepostButton()) {
            log("✅ Remove repost غير موجود بعد إعادة الفتح — العملية نجحت");
            await pressEscape();
            return true;
        }

        log("❌ Remove repost ما زال موجودًا");
        await pressEscape();
        return false;
    }

    async function removeCurrentRepost() {
        log("🔍 البحث عن زر Share...");
        const shareBtn = await waitForElement(findShareButton, 10000);
        if (!shareBtn) throw new Error("Share button not found");

        log("✅ تم العثور على Share");
        try { shareBtn.scrollIntoView({ block: "center", inline: "center" }); } catch (_) {}
        await delay(300);
        shareBtn.click();
        log("📂 تم فتح قائمة المشاركة");
        await delay(CONFIG.shareWait);

        const removeBtn = await waitForElement(findRemoveRepostButton, 8000);
        if (!removeBtn) throw new Error("Remove repost button not found");

        log("🗑️ تم العثور على Remove repost");
        try { removeBtn.scrollIntoView({ block: "center", inline: "center" }); } catch (_) {}
        await delay(300);
        removeBtn.click();
        log("🖱️ تم الضغط على Remove repost");
        await delay(CONFIG.successWait);

        if (await verifyRemoval()) {
            log("🎉 تمت إزالة إعادة النشر بنجاح");
            return true;
        }
        throw new Error("Removal could not be verified");
    }

    async function processWithRetry() {
        for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
            try {
                log(`🔄 محاولة ${attempt}/${CONFIG.maxRetries}`);
                if (await removeCurrentRepost()) return true;
            } catch (error) {
                console.warn(`[HEMA] محاولة ${attempt} فشلت:`, error.message);
                
                try {
                    await pressEscape();
                    await delay(700);
                    const share = findShareButton();
                    if (share) {
                        share.click();
                        await delay(900);
                        if (!findRemoveRepostButton()) {
                            log("✅ تحقق إضافي: Remove repost غير موجود — اعتبار العملية ناجحة");
                            await pressEscape();
                            return true;
                        }
                        await pressEscape();
                    }
                } catch (verificationError) {
                    console.warn("[HEMA] Verification retry error:", verificationError);
                }

                if (attempt < CONFIG.maxRetries) {
                    log(`⏳ إعادة المحاولة بعد ${CONFIG.retryDelay}ms`);
                    await delay(CONFIG.retryDelay);
                }
            }
        }
        return false;
    }

    function collectVideoLinks() {
        const links = Array.from(document.querySelectorAll("a[href]"))
            .map(a => a.href)
            .filter(href => {
                try { return new URL(href).pathname.includes("/video/"); } catch (_) { return false; }
            });
        return [...new Set(links)];
    }

    /* =========================================================
       Control Panel & UI
       ========================================================= */

    function createControlPanel() {
        if (!document.body) return;
        const state = getState();
        let panel = document.getElementById(PANEL_ID);

        // إذا كانت اللوحة موجودة، نقوم بتحديث البيانات فقط دون إعادة بناء الـ HTML
        if (panel) {
            if (state.isRunning) {
                const progressEl = document.getElementById("hema-progress-bar");
                const statsEl = document.getElementById("hema-stats-text");
                const countsEl = document.getElementById("hema-counts-text");
                
                if (progressEl && statsEl && countsEl) {
                    const progress = state.targetCount > 0 ? Math.round((state.deletedCount / state.targetCount) * 100) : 0;
                    const remaining = Math.max(0, state.targetCount - state.deletedCount);
                    
                    progressEl.style.width = `${Math.min(progress, 100)}%`;
                    countsEl.innerHTML = `تم حذف: <b style="color:#fe2c55; font-size:20px;">${state.deletedCount}</b> / ${state.targetCount}`;
                    statsEl.innerHTML = `التقدم: ${progress}% <br> فشل: ${state.failedCount} <br> متبقي: ${remaining}`;
                }
            }
            return; // إنهاء الدالة لمنع إعادة بناء اللوحة بالكامل
        }

        // إنشاء اللوحة لأول مرة
        panel = document.createElement("div");
        panel.id = PANEL_ID;
        Object.assign(panel.style, {
            position: "fixed", top: "70px", right: "15px", zIndex: "2147483647",
            background: "rgba(18,18,18,.97)", color: "#fff", border: "2px solid #fe2c55",
            borderRadius: "14px", padding: "15px", fontFamily: "Arial,sans-serif",
            boxShadow: "0 8px 25px rgba(0,0,0,.65)", width: "230px", textAlign: "center",
            direction: "rtl", backdropFilter: "blur(8px)", boxSizing: "border-box"
        });
        document.body.appendChild(panel);

        if (!state.isRunning) {
            panel.innerHTML = `
                <h4 style="margin:0 0 8px; color:#fe2c55;">🧹 تنظيف الريبوست</h4>
                <p style="font-size:11px; color:#bbb; margin:0 0 12px;">افتح قسم الريبوست أولاً</p>
                <label style="display:block; font-size:12px; margin-bottom:6px;">عدد الريبوست:</label>
                <input id="hema-target-count" type="number" min="1" max="${CONFIG.maxQueueSize}" value="10" 
                    style="box-sizing:border-box; width:100%; padding:9px; margin-bottom:10px; text-align:center; border-radius:7px; border:1px solid #444; background:#222; color:#fff; font-weight:bold; outline:none;">
                <button id="hema-start" style="width:100%; padding:10px; border:0; border-radius:7px; background:#fe2c55; color:#fff; font-weight:bold; cursor:pointer;">🚀 ابدأ التنظيف</button>
                <div style="margin-top:10px; font-size:9px; color:#777;">HEMA Repost Cleaner</div>
            `;
            document.getElementById("hema-start").onclick = startCleaner;
        } else {
            const progress = state.targetCount > 0 ? Math.round((state.deletedCount / state.targetCount) * 100) : 0;
            const remaining = Math.max(0, state.targetCount - state.deletedCount);
            
            panel.innerHTML = `
                <h4 style="margin:0 0 10px; color:#00f2fe;">⚙️ جاري التنظيف</h4>
                <div id="hema-counts-text" style="font-size:13px; margin-bottom:8px;">
                    تم حذف: <b style="color:#fe2c55; font-size:20px;">${state.deletedCount}</b> / ${state.targetCount}
                </div>
                <div style="background:#333; height:7px; border-radius:10px; overflow:hidden; margin-bottom:10px;">
                    <div id="hema-progress-bar" style="width:${Math.min(progress, 100)}%; height:100%; background:#fe2c55; transition:width .3s;"></div>
                </div>
                <div id="hema-stats-text" style="font-size:11px; color:#aaa; margin-bottom:10px; line-height:1.8;">
                    التقدم: ${progress}% <br> فشل: ${state.failedCount} <br> متبقي: ${remaining}
                </div>
                <button id="hema-stop" style="width:100%; padding:10px; border:0; border-radius:7px; background:#555; color:#fff; font-weight:bold; cursor:pointer;">🛑 إيقاف</button>
            `;
            document.getElementById("hema-stop").onclick = stopCleaner;
        }
    }

    /* =========================================================
       Core Logic
       ========================================================= */

    function startCleaner() {
        const input = document.getElementById("hema-target-count");
        let target = parseInt(input?.value || "0", 10);

        if (Number.isNaN(target) || target <= 0) return alert("⚠️ اكتب رقم صحيح.");
        if (target > CONFIG.maxQueueSize) target = CONFIG.maxQueueSize;

        let links = collectVideoLinks();
        if (!links.length) return alert("⚠️ لم أجد أي فيديوهات.\n\nافتح قسم الريبوست وحمّل الفيديوهات المطلوبة على الشاشة أولاً.");
        if (target > links.length) {
            alert(`⚠️ طلبت حذف ${target}، لكن الموجود حاليًا ${links.length} فقط.\n\nسيتم استخدام ${links.length} فيديو.`);
            target = links.length;
        }

        saveState({
            isRunning: true, targetCount: target, deletedCount: 0,
            failedCount: 0, currentIndex: 0, queue: links.slice(0, target)
        });

        log("🚀 Cleaner started");
        log("📊 عدد الفيديوهات:", target);
        
        // مسح اللوحة لإعادة رسمها بشكل التشغيل
        const panel = document.getElementById(PANEL_ID);
        if(panel) panel.remove(); 
        createControlPanel();

        window.location.href = getState().queue[0];
    }

    function stopCleaner() {
        clearState();
        log("🛑 Cleaner stopped");
        alert("🛑 تم إيقاف الأداة.");
        location.reload();
    }

    function finishCleaner(state) {
        log("🎉 Finished. Deleted:", state.deletedCount, "Failed:", state.failedCount);
        clearState();
        alert(`🎉 انتهت العملية!\n\nتم حذف: ${state.deletedCount}\nفشل: ${state.failedCount}`);
        
        const panel = document.getElementById(PANEL_ID);
        if(panel) panel.remove();
        createControlPanel();
    }

    async function processQueue() {
        let state = getState();
        if (!state.isRunning) return;

        if (!state.queue.length || state.deletedCount >= state.targetCount) {
            return finishCleaner(state);
        }

        log(`📹 الفيديو ${state.currentIndex + 1}/${state.targetCount}`);
        await delay(CONFIG.initialWait);
        state = getState();
        if (!state.isRunning) return;

        const success = await processWithRetry();
        state = getState();

        if (success) {
            state.deletedCount++;
            log(`✅ تم الحذف: ${state.deletedCount}/${state.targetCount}`);
        } else {
            state.failedCount++;
            log(`❌ فشل الفيديو الحالي. عدد الفشل: ${state.failedCount}`);
        }

        state.queue.shift();
        state.currentIndex++;
        saveState(state);
        createControlPanel();

        if (state.queue.length === 0 || state.deletedCount >= state.targetCount) {
            return finishCleaner(state);
        }

        const wait = randomDelay(CONFIG.minNextDelay, CONFIG.maxNextDelay);
        log(`⏳ الفيديو التالي بعد ${wait}ms`);
        await delay(wait);
        
        state = getState();
        if (!state.isRunning) return;
        if (state.queue.length > 0) window.location.href = state.queue[0];
    }

    function init() {
        createControlPanel();
        const state = getState();
        if (state.isRunning) {
            log("🔄 استئناف العملية...");
            setTimeout(processQueue, 1000);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

    setInterval(() => {
        if (!document.getElementById(PANEL_ID) || getState().isRunning) {
            createControlPanel();
        }
    }, 2000);

})();
