// التأكد إن الزرار مش موجود قبل كده عشان ميتكررش
if (!document.getElementById("hema-repost-btn")) {
    
    // إنشاء الزرار
    const btn = document.createElement("button");
    btn.id = "hema-repost-btn";
    btn.innerText = "🗑️ ابدأ حذف الريبوستات";
    
    // تصميم الزرار (عائم في أسفل يمين الشاشة)
    Object.assign(btn.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: "999999", // عشان يفضل فوق أي حاجة في الصفحة
        backgroundColor: "#fe2c55", // لون تيك توك
        color: "white",
        border: "none",
        borderRadius: "8px",
        padding: "12px 20px",
        fontSize: "16px",
        fontWeight: "bold",
        boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
        cursor: "pointer"
    });

    // حقن الزرار جوه صفحة تيك توك
    document.body.appendChild(btn);

    // الأوامر اللي هتتنفذ لما تدوس على الزرار
    btn.addEventListener("click", () => {
        alert("عاش! الزرار شغال وجاهزين نكتب كود الحذف.");
    });
}
