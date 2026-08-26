// إنشاء لوحة التحكم العائمة
function createControlPanel() {
    if (document.getElementById("hema-control-panel")) return;
    if (!document.body) return;

    const panel = document.createElement("div");
    panel.id = "hema-control-panel";
    
    // تصميم اللوحة (فوق على اليمين)
    Object.assign(panel.style, {
        position: "fixed",
        top: "80px", // نزلناها شوية عشان شريط المتصفح
        right: "20px",
        zIndex: "2147483647",
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        color: "white",
        border: "2px solid #fe2c55",
        borderRadius: "10px",
        padding: "15px",
        fontFamily: "Arial, sans-serif",
        boxShadow: "0 4px 8px rgba(0,0,0,0.5)",
        width: "200px",
        textAlign: "center",
        direction: "rtl"
    });

    // محتوى اللوحة (HTML)
    panel.innerHTML = `
        <h4 style="margin: 0 0 10px 0; color: #fe2c55;">أداة الحذف</h4>
        <label style="font-size: 12px;">كم ريبوست تريد حذفه؟</label>
        <input type="number" id="targetCount" value="10" style="width: 80%; margin: 5px 0 10px; padding: 5px; text-align: center; border-radius: 5px; border: none;">
        
        <div style="font-size: 14px; margin-bottom: 10px;">
            تم حذف: <span id="deletedCount" style="color: #00f2fe; font-weight: bold;">0</span>
        </div>
        
        <button id="startDeleteBtn" style="background-color: #fe2c55; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; width: 100%;">🚀 ابدأ الآن</button>
        <button id="stopDeleteBtn" style="background-color: #555; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; width: 100%; margin-top: 5px; display: none;">🛑 إيقاف</button>
    `;

    document.body.appendChild(panel);

    // ربط الأزرار بالكود
    let isRunning = false;

    document.getElementById("startDeleteBtn").addEventListener("click", async () => {
        let target = parseInt(document.getElementById("targetCount").value);
        if (isNaN(target) || target <= 0) {
            alert("اكتب رقم صحيح!");
            return;
        }
        
        isRunning = true;
        document.getElementById("startDeleteBtn").style.display = "none";
        document.getElementById("stopDeleteBtn").style.display = "inline-block";
        
        await startDeletionProcess(target, () => isRunning);
    });

    document.getElementById("stopDeleteBtn").addEventListener("click", () => {
        isRunning = false;
        document.getElementById("startDeleteBtn").style.display = "inline-block";
        document.getElementById("stopDeleteBtn").style.display = "none";
    });
}

// دالة الانتظار
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// كود الحذف الفعلي
async function startDeletionProcess(targetCount, checkRunning) {
    let deleted = 0;
    const deletedCountSpan = document.getElementById("deletedCount");

    for (let i = 0; i < targetCount; i++) {
        if (!checkRunning()) {
            alert("تم إيقاف العملية.");
            break;
        }

        try {
            // 1. الضغط على زر المشاركة (Share) - بنبحث عن الأيقونة أو الكلاس
            let shareBtn = document.querySelector('button[aria-label="Share"], span[data-e2e="share-icon"]');
            if (shareBtn) {
                shareBtn.click();
                await delay(1500); // استنى القائمة تفتح
                
                // 2. البحث عن زر "إلغاء إعادة النشر" (نبحث عن النص نفسه عشان الكلاسات بتتغير)
                let allButtons = Array.from(document.querySelectorAll('button, span, div'));
                let unRepostBtn = allButtons.find(el => el.innerText && (el.innerText.includes('إزالة إعادة النشر') || el.innerText.includes('Remove repost')));
                
                if (unRepostBtn) {
                    unRepostBtn.click();
                    deleted++;
                    deletedCountSpan.innerText = deleted;
                    await delay(2000); // استنى رسالة التأكيد
                } else {
                    // لو ملقاش الزرار، يقفل قائمة المشاركة
                    let closeBtn = document.querySelector('button[aria-label="Close"], .close-button-class');
                    if(closeBtn) closeBtn.click();
                }
            }

            // 3. الانتقال للفيديو التالي (السحب لتحت)
            let nextBtn = document.querySelector('button[aria-label="Next video"], .arrow-right, .video-card-down');
            if (nextBtn) {
                nextBtn.click();
            } else {
                window.scrollBy(0, window.innerHeight); // محاكاة السحب
            }

            // 4. تأخير عشوائي عشان الحظر
            let randomWait = Math.floor(Math.random() * (5000 - 3000 + 1) + 3000);
            await delay(randomWait);

        } catch (error) {
            console.log("حدث خطأ في هذا الفيديو، جاري التخطي...");
        }
    }

    if (checkRunning()) {
        alert("🎉 تم الانتهاء من فحص/حذف العدد المطلوب!");
        document.getElementById("startDeleteBtn").style.display = "inline-block";
        document.getElementById("stopDeleteBtn").style.display = "none";
    }
}

// تشغيل اللوحة ومراقبتها
setTimeout(createControlPanel, 3000);
setInterval(createControlPanel, 2000);
