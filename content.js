function createFloatingButton() {
    // إذا كان الزر موجوداً مسبقاً، لا تفعل شيئاً
    if (document.getElementById("hema-repost-btn")) return;

    // التأكد من أن الصفحة (body) أصبحت موجودة
    if (!document.body) return;

    const btn = document.createElement("button");
    btn.id = "hema-repost-btn";
    btn.innerText = "🗑️ ابدأ الحذف";
    
    // تصميم الزر ليكون بارزاً
    Object.assign(btn.style, {
        position: "fixed",
        bottom: "30px",
        left: "20px", // تم نقله لليسار لتجنب أزرار تيك توك الأساسية
        zIndex: "2147483647", // أعلى طبقة ممكنة في المتصفح
        backgroundColor: "#fe2c55",
        color: "white",
        border: "2px solid white",
        borderRadius: "10px",
        padding: "12px 20px",
        fontSize: "16px",
        fontWeight: "bold",
        boxShadow: "0 4px 8px rgba(0,0,0,0.5)",
        cursor: "pointer"
    });

    document.body.appendChild(btn);

    btn.addEventListener("click", () => {
        alert("الزر يعمل بنجاح! يمكننا الآن كتابة كود الحذف.");
    });
}

// تشغيل الدالة بعد 3 ثوانٍ من فتح الصفحة
setTimeout(createFloatingButton, 3000);

// مراقبة الصفحة كل ثانيتين لضمان بقاء الزر (لأن تيك توك يحذف العناصر الغريبة)
setInterval(createFloatingButton, 2000);
