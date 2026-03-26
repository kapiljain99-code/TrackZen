const tokenKey = "streak_tracker_token";
const themeKey = "streak_tracker_theme";
const apiBase =
    window.location.protocol === "file:" ||
    (["127.0.0.1", "localhost"].includes(window.location.hostname) && window.location.port !== "8000")
        ? "http://127.0.0.1:8000"
        : "";

function getToken() {
    return localStorage.getItem(tokenKey);
}

function setToken(token) {
    localStorage.setItem(tokenKey, token);
}

function clearToken() {
    localStorage.removeItem(tokenKey);
}

function applyTheme(theme) {
    const useLightTheme = theme === "light";
    document.body.classList.toggle("theme-light", useLightTheme);

    const toggleButton = document.getElementById("theme-toggle");
    if (toggleButton) {
        toggleButton.textContent = useLightTheme ? "Switch to Dark Mode" : "Switch to Light Mode";
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem(themeKey) || "dark";
    applyTheme(savedTheme);

    const toggleButton = document.getElementById("theme-toggle");
    if (!toggleButton) {
        return;
    }

    toggleButton.addEventListener("click", () => {
        const nextTheme = document.body.classList.contains("theme-light") ? "dark" : "light";
        localStorage.setItem(themeKey, nextTheme);
        applyTheme(nextTheme);
    });
}

function triggerCheckinCelebration() {
    const celebration = document.getElementById("checkin-celebration");
    if (!celebration) {
        return;
    }

    celebration.classList.remove("is-active");
    void celebration.offsetWidth;
    celebration.classList.add("is-active");

    window.setTimeout(() => {
        celebration.classList.remove("is-active");
    }, 1100);
}

function calculateLevel(streakCount) {
    const levels = [
        { min: 0, max: 2, title: "Starter Spark" },
        { min: 3, max: 6, title: "Momentum Maker" },
        { min: 7, max: 13, title: "Consistency Core" },
        { min: 14, max: 20, title: "Habit Builder" },
        { min: 21, max: 29, title: "Discipline Flame" },
        { min: 30, max: 44, title: "Streak Master" },
        { min: 45, max: 999999, title: "Legend Mode" },
    ];

    const levelIndex = levels.findIndex((level) => streakCount >= level.min && streakCount <= level.max);
    const currentIndex = levelIndex === -1 ? levels.length - 1 : levelIndex;
    const currentLevel = levels[currentIndex];
    const nextLevel = levels[currentIndex + 1] || null;
    const progressRange = Math.max(currentLevel.max - currentLevel.min + 1, 1);
    const progressValue = Math.min(streakCount - currentLevel.min + 1, progressRange);
    const progressPercent = nextLevel ? (progressValue / progressRange) * 100 : 100;
    const daysRemaining = nextLevel ? Math.max(nextLevel.min - streakCount, 0) : 0;

    return {
        levelNumber: currentIndex + 1,
        title: currentLevel.title,
        progressPercent,
        caption: nextLevel
            ? `${daysRemaining} more day${daysRemaining === 1 ? "" : "s"} to reach Level ${currentIndex + 2}`
            : "You reached the highest streak level.",
    };
}

function renderLevel(streakCount) {
    const badge = document.getElementById("level-badge");
    const title = document.getElementById("level-title");
    const progressFill = document.getElementById("level-progress-fill");
    const caption = document.getElementById("level-caption");

    if (!badge || !title || !progressFill || !caption) {
        return;
    }

    const levelData = calculateLevel(streakCount);
    badge.textContent = `Level ${levelData.levelNumber}`;
    title.textContent = levelData.title;
    progressFill.style.width = `${levelData.progressPercent}%`;
    caption.textContent = levelData.caption;
}

function setMessage(elementId, message, type = "") {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `message ${type}`.trim();
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };
        return entities[character];
    });
}

async function apiRequest(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let response;
    try {
        response = await fetch(`${apiBase}${path}`, { ...options, headers });
    } catch (error) {
        throw new Error("Cannot reach the server. Start FastAPI and open the app from http://127.0.0.1:8000.");
    }

    const rawText = await response.text();
    let data = {};

    if (rawText) {
        try {
            data = JSON.parse(rawText);
        } catch (error) {
            data = { detail: rawText };
        }
    }

    if (!response.ok) {
        if (Array.isArray(data.detail)) {
            const validationMessage = data.detail
                .map((item) => item.msg)
                .filter(Boolean)
                .join(", ");
            throw new Error(validationMessage || `Request failed with status ${response.status}.`);
        }

        throw new Error(
            data.detail ||
            data.message ||
            (response.status === 405
                ? "Method not allowed. The page is likely not connected to the FastAPI backend at http://127.0.0.1:8000."
                : null) ||
            `Request failed with status ${response.status}.`
        );
    }

    return data;
}

async function handleAuthForm(formId, endpoint, messageId) {
    const form = document.getElementById(formId);
    if (!form) {
        return;
    }

    if (getToken()) {
        window.location.href = "/dashboard.html";
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage(messageId, "");

        const formData = new FormData(form);
        const payload = {
            username: formData.get("username").trim(),
            password: formData.get("password"),
        };

        const recoveryPin = formData.get("recovery_pin");
        if (recoveryPin !== null) {
            payload.recovery_pin = String(recoveryPin).trim();
        }

        if (payload.username.length < 3) {
            setMessage(messageId, "Username must be at least 3 characters.", "error");
            return;
        }

        if (payload.password.length < 6) {
            setMessage(messageId, "Password must be at least 6 characters.", "error");
            return;
        }

        if (payload.recovery_pin !== undefined) {
            if (!/^\d{4}$/.test(payload.recovery_pin)) {
                setMessage(messageId, "Recovery PIN must be exactly 4 digits.", "error");
                return;
            }
        }

        try {
            const data = await apiRequest(endpoint, {
                method: "POST",
                body: JSON.stringify(payload),
            });

            setToken(data.token);
            setMessage(messageId, data.message, "success");
            window.location.href = "/dashboard.html";
        } catch (error) {
            setMessage(messageId, error.message, "error");
        }
    });
}

function redirectToLogin() {
    clearToken();
    window.location.href = "/login.html";
}

function renderUser(user) {
    document.getElementById("welcome-text").textContent = `Welcome, ${user.username}`;
    document.getElementById("mission-display").textContent = user.mission || "No mission set yet";
    document.getElementById("mission-input").value = user.mission || "";
    document.getElementById("current-streak").textContent = user.current_streak;
    document.getElementById("longest-streak").textContent = user.longest_streak;
    renderLevel(user.current_streak);

    const learningInput = document.getElementById("learning-input");
    if (learningInput) {
        learningInput.value = user.learned_today || "";
    }

    const badge = document.getElementById("status-badge");
    const checkinButton = document.getElementById("checkin-btn");

    if (user.done_today) {
        badge.textContent = "Done today";
        badge.classList.add("done");
        checkinButton.disabled = true;
    } else {
        badge.textContent = "Not done today";
        badge.classList.remove("done");
        checkinButton.disabled = false;
    }
}

function renderLeaderboard(rows) {
    const container = document.getElementById("leaderboard-list");
    if (!container) {
        return;
    }

    if (!rows.length) {
        container.innerHTML = "<p>No participants have checked in yet.</p>";
        return;
    }

    container.innerHTML = rows
        .map((user, index) => {
            const missionPreview = user.mission ? user.mission : "No mission yet";
            const medal = index === 0 ? "01" : index === 1 ? "02" : index === 2 ? "03" : String(index + 1).padStart(2, "0");
            return `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank">${medal}</div>
                    <div class="leaderboard-user">
                        <p><strong>${escapeHtml(user.username)}</strong></p>
                        <p class="mission-preview">${escapeHtml(missionPreview)}</p>
                    </div>
                    <div class="leaderboard-score">${user.current_streak} day${user.current_streak === 1 ? "" : "s"}</div>
                </div>
            `;
        })
        .join("");
}

function renderHistory(rows) {
    const container = document.getElementById("history-list");
    if (!container) {
        return;
    }

    if (!rows.length) {
        container.innerHTML = "<p>No learning journal entries yet. Save what you learned today to start your history.</p>";
        return;
    }

    container.innerHTML = rows
        .map((entry) => `
            <div class="history-item">
                <p class="history-date">${formatHistoryDate(entry.date)}</p>
                <p class="history-text">${escapeHtml(entry.learned_today)}</p>
            </div>
        `)
        .join("");
}

function formatHistoryDate(dateString) {
    const parsedDate = new Date(dateString);
    if (Number.isNaN(parsedDate.getTime())) {
        return escapeHtml(dateString);
    }

    return escapeHtml(
        parsedDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        })
    );
}

function handleResetForm() {
    const form = document.getElementById("reset-form");
    if (!form) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage("reset-message", "");

        const formData = new FormData(form);
        const payload = {
            username: String(formData.get("username") || "").trim(),
            recovery_pin: String(formData.get("recovery_pin") || "").trim(),
            new_password: String(formData.get("new_password") || ""),
        };

        if (payload.username.length < 3) {
            setMessage("reset-message", "Username must be at least 3 characters.", "error");
            return;
        }

        if (!/^\d{4}$/.test(payload.recovery_pin)) {
            setMessage("reset-message", "Recovery PIN must be exactly 4 digits.", "error");
            return;
        }

        if (payload.new_password.length < 6) {
            setMessage("reset-message", "New password must be at least 6 characters.", "error");
            return;
        }

        try {
            const data = await apiRequest("/reset-password", {
                method: "POST",
                body: JSON.stringify(payload),
            });
            setMessage("reset-message", data.message, "success");
            form.reset();
        } catch (error) {
            setMessage("reset-message", error.message, "error");
        }
    });
}

async function loadDashboard() {
    if (!document.getElementById("welcome-text")) {
        return;
    }

    if (!getToken()) {
        window.location.href = "/login.html";
        return;
    }

    try {
        const [user, leaderboardData, historyData] = await Promise.all([
            apiRequest("/me"),
            apiRequest("/leaderboard"),
            apiRequest("/learning-history"),
        ]);
        renderUser(user);
        renderLeaderboard(leaderboardData.leaderboard);
        renderHistory(historyData.history);
    } catch (error) {
        redirectToLogin();
        return;
    }

    document.getElementById("logout-btn").addEventListener("click", redirectToLogin);

    document.getElementById("mission-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage("mission-message", "");

        const mission = document.getElementById("mission-input").value.trim();
        if (!mission) {
            setMessage("mission-message", "Mission cannot be empty.", "error");
            return;
        }

        try {
            const data = await apiRequest("/mission", {
                method: "PUT",
                body: JSON.stringify({ mission }),
            });
            renderUser(data.user);
            setMessage("mission-message", data.message, "success");

            const leaderboardData = await apiRequest("/leaderboard");
            renderLeaderboard(leaderboardData.leaderboard);
        } catch (error) {
            setMessage("mission-message", error.message, "error");
        }
    });

    document.getElementById("checkin-btn").addEventListener("click", async () => {
        setMessage("checkin-message", "");

        try {
            const data = await apiRequest("/checkin", { method: "POST" });
            renderUser(data.user);
            setMessage("checkin-message", data.message, "success");
            if (data.message === "Check-in saved.") {
                triggerCheckinCelebration();
            }

            const leaderboardData = await apiRequest("/leaderboard");
            renderLeaderboard(leaderboardData.leaderboard);
        } catch (error) {
            setMessage("checkin-message", error.message, "error");
        }
    });

    document.getElementById("learning-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage("learning-message", "");

        const learnedToday = document.getElementById("learning-input").value.trim();
        if (!learnedToday) {
            setMessage("learning-message", "Write what you learned today before saving.", "error");
            return;
        }

        try {
            const data = await apiRequest("/today-learning", {
                method: "PUT",
                body: JSON.stringify({ learned_today: learnedToday }),
            });
            renderUser(data.user);
            setMessage("learning-message", data.message, "success");

            const historyData = await apiRequest("/learning-history");
            renderHistory(historyData.history);
        } catch (error) {
            setMessage("learning-message", error.message, "error");
        }
    });
}

handleAuthForm("login-form", "/login", "login-message");
handleAuthForm("signup-form", "/signup", "signup-message");
initializeTheme();
handleResetForm();
loadDashboard();
