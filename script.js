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

    document.querySelectorAll("#theme-toggle, #theme-toggle-settings").forEach((toggleButton) => {
        toggleButton.textContent = useLightTheme ? "Switch to Dark Mode" : "Switch to Light Mode";
    });
}

function toggleTheme() {
    const nextTheme = document.body.classList.contains("theme-light") ? "dark" : "light";
    localStorage.setItem(themeKey, nextTheme);
    applyTheme(nextTheme);
}

function initializeTheme() {
    const savedTheme = localStorage.getItem(themeKey) || "light";
    applyTheme(savedTheme);

    document.querySelectorAll("#theme-toggle, #theme-toggle-settings").forEach((toggleButton) => {
        toggleButton.addEventListener("click", toggleTheme);
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

function animateNumber(element, nextValue) {
    if (!element) {
        return;
    }

    const target = Number(nextValue) || 0;
    const start = Number(element.dataset.value || element.textContent || 0) || 0;
    const startTime = performance.now();
    const duration = 700;

    element.dataset.value = String(target);

    function step(currentTime) {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(start + (target - start) * eased);
        element.textContent = String(currentValue);

        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    }

    window.requestAnimationFrame(step);
}

function formatDayCount(value) {
    const count = Number(value) || 0;
    return `${count} day${count === 1 ? "" : "s"}`;
}

function formatLastActive(dateString) {
    if (!dateString) {
        return "No check-ins yet";
    }

    const parsedDate = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
        return dateString;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffInMs = today.getTime() - parsedDate.getTime();
    const diffInDays = Math.round(diffInMs / 86400000);

    if (diffInDays === 0) {
        return "Checked in today";
    }

    if (diffInDays === 1) {
        return "Last active yesterday";
    }

    return `Last active ${parsedDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    })}`;
}

function getNextMilestone(streakCount) {
    const milestones = [3, 7, 14, 21, 30, 45, 60, 90, 120];
    const current = Number(streakCount) || 0;
    const nextMilestone = milestones.find((milestone) => current < milestone) || null;

    if (!nextMilestone) {
        return {
            title: "Archive favorite",
            copy: "You are beyond the core milestone set now.",
        };
    }

    const daysLeft = nextMilestone - current;
    return {
        title: `${nextMilestone}-day streak`,
        copy: `${daysLeft} more day${daysLeft === 1 ? "" : "s"} to get there.`,
    };
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

function updateLearningMeta() {
    const learningInput = document.getElementById("learning-input");
    const lengthLabel = document.getElementById("learning-length");
    if (!learningInput || !lengthLabel) {
        return;
    }

    lengthLabel.textContent = `${learningInput.value.trim().length} / 600 characters`;
}

function renderOverview(user) {
    const currentStreak = Number(user.current_streak) || 0;
    const longestStreak = Number(user.longest_streak) || 0;
    const milestone = getNextMilestone(currentStreak);
    const currentStreakLabel = document.getElementById("overview-current-streak");
    const currentStreakNote = document.getElementById("overview-streak-note");
    const longestStreakLabel = document.getElementById("overview-longest-streak");
    const bestNote = document.getElementById("overview-best-note");
    const todayStatus = document.getElementById("overview-today-status");
    const statusNote = document.getElementById("overview-status-note");
    const milestoneLabel = document.getElementById("overview-next-milestone");
    const milestoneNote = document.getElementById("overview-milestone-note");

    if (currentStreakLabel) {
        currentStreakLabel.textContent = formatDayCount(currentStreak);
    }
    if (currentStreakNote) {
        currentStreakNote.textContent = currentStreak > 0
            ? `You have shown up ${formatDayCount(currentStreak)} in a row.`
            : "Start your first streak today.";
    }

    if (longestStreakLabel) {
        longestStreakLabel.textContent = formatDayCount(longestStreak);
    }
    if (bestNote) {
        bestNote.textContent = longestStreak > 0
            ? `Your strongest run so far is ${formatDayCount(longestStreak)}.`
            : "Your personal best will appear here.";
    }

    if (todayStatus) {
        todayStatus.textContent = user.done_today
            ? "Complete"
            : user.can_check_in_today
                ? "Ready to lock"
                : "Waiting";
    }
    if (statusNote) {
        statusNote.textContent = user.done_today
            ? "Today is protected. You can still refine your learning note."
            : user.can_check_in_today
                ? "Your learning note is saved. Check in when you are ready."
                : "Save what you learned to unlock check-in.";
    }

    if (milestoneLabel) {
        milestoneLabel.textContent = milestone.title;
    }
    if (milestoneNote) {
        milestoneNote.textContent = milestone.copy;
    }
}

function setMessage(elementId, message, type = "") {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `message ${type}`.trim();
}

function setButtonLoading(button, isLoading, loadingText = "Loading...") {
    if (!button) {
        return;
    }

    if (isLoading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent.trim();
        }
        button.disabled = true;
        button.classList.add("is-loading");
        button.textContent = loadingText;
        return;
    }

    button.disabled = button.id === "checkin-btn" && button.dataset.locked === "true";
    button.classList.remove("is-loading");
    if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
    }
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
        const submitButton = form.querySelector('button[type="submit"]');

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
            setButtonLoading(submitButton, true, endpoint === "/signup" ? "Creating account..." : "Signing in...");
            const data = await apiRequest(endpoint, {
                method: "POST",
                body: JSON.stringify(payload),
            });

            setToken(data.token);
            setMessage(messageId, data.message, "success");
            window.location.href = "/dashboard.html";
        } catch (error) {
            setMessage(messageId, error.message, "error");
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

function redirectToLogin() {
    clearToken();
    window.location.href = "/login.html";
}

function renderUser(user) {
    document.getElementById("welcome-text").textContent = `Welcome, ${user.username}`;
    const topbarSubtext = document.getElementById("topbar-subtext");
    if (topbarSubtext) {
        topbarSubtext.textContent = user.mission
            ? `Current collection: ${user.mission}`
            : "Set one clear mission, log one useful lesson, and keep your daily flow moving.";
    }
    document.getElementById("mission-display").textContent = user.mission || "No mission set yet";
    document.getElementById("mission-input").value = user.mission || "";
    animateNumber(document.getElementById("current-streak"), user.current_streak);
    animateNumber(document.getElementById("longest-streak"), user.longest_streak);
    renderLevel(user.current_streak);
    renderOverview(user);

    const learningInput = document.getElementById("learning-input");
    if (learningInput) {
        learningInput.value = user.learned_today || "";
    }
    updateLearningMeta();

    const focusModeCopy = document.getElementById("focus-mode-copy");
    if (focusModeCopy) {
        focusModeCopy.textContent = user.mission ? "Mission set and visible" : "Add one mission to anchor today";
    }

    const lastActiveCopy = document.getElementById("last-active-copy");
    if (lastActiveCopy) {
        lastActiveCopy.textContent = formatLastActive(user.last_active_date);
    }

    const badge = document.getElementById("status-badge");
    const checkinButton = document.getElementById("checkin-btn");
    const checkinHelper = document.getElementById("checkin-helper");

    if (user.done_today) {
        badge.textContent = "Done today";
        badge.classList.add("done");
        checkinButton.disabled = true;
        checkinButton.dataset.locked = "true";
        if (checkinHelper) {
            checkinHelper.textContent = "Today is already locked in. You can still edit your learning entry below.";
        }
    } else if (!user.can_check_in_today) {
        badge.textContent = "Write first";
        badge.classList.remove("done");
        checkinButton.disabled = true;
        checkinButton.dataset.locked = "true";
        if (checkinHelper) {
            checkinHelper.textContent = "Add what you learned today before marking the day as done.";
        }
    } else {
        badge.textContent = "Not done today";
        badge.classList.remove("done");
        checkinButton.disabled = false;
        checkinButton.dataset.locked = "false";
        if (checkinHelper) {
            checkinHelper.textContent = "Your learning note is saved. You can lock in today whenever you are ready.";
        }
    }
}

function renderLeaderboard(rows) {
    const container = document.getElementById("leaderboard-list");
    const summary = document.getElementById("leaderboard-summary");
    if (!container) {
        return;
    }

    if (!rows.length) {
        if (summary) {
            summary.textContent = "The board wakes up once people start checking in.";
        }
        container.innerHTML = "<p>No participants have checked in yet.</p>";
        return;
    }

    if (summary) {
        const leader = rows[0];
        summary.textContent = `${leader.username} is the most active right now with ${formatDayCount(leader.current_streak)}.`;
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
            <div class="history-item" data-entry-date="${escapeHtml(entry.date)}">
                <div class="history-item-top">
                    <p class="history-date">${formatHistoryDate(entry.date)}</p>
                    <div class="history-actions">
                        <button type="button" class="ghost-btn history-edit-btn">Edit</button>
                    </div>
                </div>
                <p class="history-text">${escapeHtml(entry.learned_today)}</p>
                <div class="history-editor" hidden>
                    <textarea class="history-editor-input" maxlength="600">${escapeHtml(entry.learned_today)}</textarea>
                    <div class="history-editor-actions">
                        <button type="button" class="primary-btn history-save-btn">Save</button>
                        <button type="button" class="ghost-btn history-cancel-btn">Cancel</button>
                    </div>
                    <p class="message history-inline-message"></p>
                </div>
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
        const submitButton = form.querySelector('button[type="submit"]');

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
            setButtonLoading(submitButton, true, "Resetting password...");
            const data = await apiRequest("/reset-password", {
                method: "POST",
                body: JSON.stringify(payload),
            });
            setMessage("reset-message", data.message, "success");
            form.reset();
        } catch (error) {
            setMessage("reset-message", error.message, "error");
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

function initializeLearningInput() {
    const learningInput = document.getElementById("learning-input");
    if (!learningInput) {
        return;
    }

    updateLearningMeta();
    learningInput.addEventListener("input", updateLearningMeta);
}

function setHistoryEditMode(item, isEditing) {
    if (!item) {
        return;
    }

    const editor = item.querySelector(".history-editor");
    const text = item.querySelector(".history-text");
    const editButton = item.querySelector(".history-edit-btn");
    const inlineMessage = item.querySelector(".history-inline-message");

    item.classList.toggle("is-editing", isEditing);
    if (editor) {
        editor.hidden = !isEditing;
    }
    if (text) {
        text.hidden = isEditing;
    }
    if (editButton) {
        editButton.hidden = isEditing;
    }
    if (inlineMessage) {
        inlineMessage.textContent = "";
        inlineMessage.className = "message history-inline-message";
    }
}

function activateSectionLink(targetId) {
    const sectionHash = targetId.startsWith("#") ? targetId : `#${targetId}`;
    document.querySelectorAll(".workspace-link").forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === sectionHash);
    });
}

function scrollToDashboardSection(sectionId, updateHistory = true) {
    const normalizedId = sectionId.startsWith("#") ? sectionId.slice(1) : sectionId;
    const section = document.getElementById(normalizedId);
    if (!section) {
        return false;
    }

    const yOffset = 18;
    const targetTop = window.scrollY + section.getBoundingClientRect().top - yOffset;
    window.scrollTo({
        top: Math.max(targetTop, 0),
        behavior: "smooth",
    });

    activateSectionLink(normalizedId);

    if (updateHistory) {
        window.history.replaceState(null, "", `#${normalizedId}`);
    }

    return true;
}

function handleDashboardNav() {
    const navLinks = Array.from(document.querySelectorAll(".workspace-link"));
    navLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            const href = link.getAttribute("href");
            if (!href || !href.startsWith("#")) {
                return;
            }

            event.preventDefault();
            scrollToDashboardSection(href);
        });
    });

    const sections = Array.from(new Set(navLinks
        .map((link) => {
            const href = link.getAttribute("href");
            return href ? document.querySelector(href) : null;
        })
        .filter(Boolean)));

    if (!sections.length) {
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            const visibleEntry = entries
                .filter((entry) => entry.isIntersecting)
                .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];

            if (!visibleEntry) {
                return;
            }

            const activeLink = navLinks.find((link) => link.getAttribute("href") === `#${visibleEntry.target.id}`);
            if (!activeLink) {
                return;
            }

            activateSectionLink(visibleEntry.target.id);
        },
        {
            rootMargin: "-20% 0px -45% 0px",
            threshold: [0.2, 0.45, 0.7],
        }
    );

    sections.forEach((section) => observer.observe(section));
    if (window.location.hash && scrollToDashboardSection(window.location.hash, false)) {
        return;
    }

    activateSectionLink(navLinks[0]?.getAttribute("href") || "#mission-section");
}

function initializeDashboardMotion() {
    const intro = document.getElementById("dashboard-intro");
    if (intro) {
        window.setTimeout(() => {
            intro.classList.add("is-hidden");
            document.body.classList.add("dashboard-ready");
        }, 900);
    } else {
        document.body.classList.add("dashboard-ready");
    }

    const panels = Array.from(document.querySelectorAll(".catalog-hero, .overview-strip, .dashboard-grid .panel, .workspace-nav"));
    const revealObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                }
            });
        },
        {
            threshold: 0.18,
            rootMargin: "0px 0px -12% 0px",
        }
    );

    panels.forEach((panel) => {
        panel.classList.add("motion-panel");
        revealObserver.observe(panel);

        panel.addEventListener("pointermove", (event) => {
            if (window.innerWidth < 900) {
                return;
            }

            const rect = panel.getBoundingClientRect();
            const offsetX = ((event.clientX - rect.left) / rect.width - 0.5) * 8;
            const offsetY = ((event.clientY - rect.top) / rect.height - 0.5) * 8;
            panel.style.setProperty("--tilt-x", `${-offsetY}deg`);
            panel.style.setProperty("--tilt-y", `${offsetX}deg`);
            panel.style.setProperty("--glow-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
            panel.style.setProperty("--glow-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
        });

        panel.addEventListener("pointerleave", () => {
            panel.style.removeProperty("--tilt-x");
            panel.style.removeProperty("--tilt-y");
            panel.style.removeProperty("--glow-x");
            panel.style.removeProperty("--glow-y");
        });
    });

    const progressBar = document.getElementById("scroll-progress-bar");
    const scrollDrivenItems = Array.from(document.querySelectorAll(".catalog-hero, .overview-strip, .dashboard-grid .panel"));

    function updateScrollMotion() {
        const scrollableHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        const scrollProgress = Math.min(window.scrollY / scrollableHeight, 1);

        if (progressBar) {
            progressBar.style.transform = `scaleX(${scrollProgress})`;
        }

        scrollDrivenItems.forEach((item) => {
            const rect = item.getBoundingClientRect();
            const distanceFromCenter = rect.top + rect.height / 2 - window.innerHeight / 2;
            const normalized = Math.max(-1, Math.min(1, distanceFromCenter / window.innerHeight));
            item.style.setProperty("--scroll-shift", `${normalized * -18}px`);
        });
    }

    updateScrollMotion();
    window.addEventListener("scroll", updateScrollMotion, { passive: true });
    window.addEventListener("resize", updateScrollMotion);
}

function handleHistoryEditing() {
    const historyList = document.getElementById("history-list");
    if (!historyList) {
        return;
    }

    historyList.addEventListener("click", async (event) => {
        const item = event.target.closest(".history-item");
        if (!item) {
            return;
        }

        if (event.target.closest(".history-edit-btn")) {
            setHistoryEditMode(item, true);
            const input = item.querySelector(".history-editor-input");
            if (input) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
            return;
        }

        if (event.target.closest(".history-cancel-btn")) {
            setHistoryEditMode(item, false);
            return;
        }

        const saveButton = event.target.closest(".history-save-btn");
        if (!saveButton) {
            return;
        }

        const entryDate = item.dataset.entryDate;
        const input = item.querySelector(".history-editor-input");
        const inlineMessage = item.querySelector(".history-inline-message");
        if (!entryDate || !input || !inlineMessage) {
            return;
        }

        const learnedToday = input.value.trim();
        if (!learnedToday) {
            inlineMessage.textContent = "Write something meaningful before saving.";
            inlineMessage.className = "message history-inline-message error";
            return;
        }

        try {
            setButtonLoading(saveButton, true, "Saving...");
            const data = await apiRequest(`/learning-history/${entryDate}`, {
                method: "PUT",
                body: JSON.stringify({ learned_today: learnedToday }),
            });
            renderUser(data.user);
            renderHistory(data.history);
        } catch (error) {
            inlineMessage.textContent = error.message;
            inlineMessage.className = "message history-inline-message error";
        } finally {
            setButtonLoading(saveButton, false);
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
    handleDashboardNav();
    handleHistoryEditing();
    initializeDashboardMotion();
    initializeLearningInput();

    document.getElementById("mission-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage("mission-message", "");
        const submitButton = event.currentTarget.querySelector('button[type="submit"]');

        const mission = document.getElementById("mission-input").value.trim();
        if (!mission) {
            setMessage("mission-message", "Mission cannot be empty.", "error");
            return;
        }

        try {
            setButtonLoading(submitButton, true, "Saving mission...");
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
        } finally {
            setButtonLoading(submitButton, false);
        }
    });

    document.getElementById("checkin-btn").addEventListener("click", async () => {
        setMessage("checkin-message", "");
        const checkinButton = document.getElementById("checkin-btn");

        try {
            setButtonLoading(checkinButton, true, "Saving check-in...");
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
        } finally {
            setButtonLoading(checkinButton, false);
        }
    });

    document.getElementById("learning-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage("learning-message", "");
        const submitButton = event.currentTarget.querySelector('button[type="submit"]');

        const learnedToday = document.getElementById("learning-input").value.trim();
        if (!learnedToday) {
            setMessage("learning-message", "Write what you learned today before saving.", "error");
            return;
        }

        try {
            setButtonLoading(submitButton, true, "Saving entry...");
            const data = await apiRequest("/today-learning", {
                method: "PUT",
                body: JSON.stringify({ learned_today: learnedToday }),
            });
            renderUser(data.user);
            setMessage("learning-message", data.message, "success");

            const historyData = await apiRequest("/learning-history");
            renderHistory(historyData.history);
            const historySectionLink = document.querySelector('.workspace-link[href="#history-section"]');
            if (historySectionLink) {
                historySectionLink.classList.add("is-active");
            }
        } catch (error) {
            setMessage("learning-message", error.message, "error");
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

handleAuthForm("login-form", "/login", "login-message");
handleAuthForm("signup-form", "/signup", "signup-message");
initializeTheme();
handleResetForm();
loadDashboard();
