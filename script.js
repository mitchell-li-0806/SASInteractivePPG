// Global variables
let courses = [];
let draggedCourseId = null;
let draggedElement = null;
let editingCourseId = null;
let draggedFromSchedule = false;
let dragCompletedInSchedule = false;

// Credit requirements for SAS graduation
const creditRequirements = {
    1: { name: "English", required: 4 },
    2: { name: "Social Studies", required: 2 },
    3: { name: "Mathematics", required: 2 },
    4: { name: "Science", required: 2 },
    5: { name: "World Languages", required: 2 },
    6: { name: "Visual & Performing Arts", required: 1 },
    7: { name: "PE & Health", required: 1.5 },
    8: { name: "Tech, CS & Robotics / Catalyst", displayName: "TCR / Catalyst", required: 0.5 }
};

function getCreditRequirementDisplayName(period) {
    const requirement = creditRequirements[period];
    return requirement ? (requirement.displayName || requirement.name) : '';
}

// Load courses from JSON database
async function loadCourses() {
    try {
        const response = await fetch('courses.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        courses = await response.json();
        console.log(`Loaded ${courses.length} courses from database`);
        return true;
    } catch (error) {
        console.error('Failed to load courses:', error);
        // Fallback to empty array
        courses = [];
        return false;
    }
}

// Save courses to JSON database (for admin functionality)
async function saveCourses() {
    try {
        const response = await fetch('courses.json', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(courses, null, 4)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        console.log('Courses saved successfully');
        return true;
    } catch (error) {
        console.error('Failed to save courses:', error);
        alert('Failed to save courses. This feature requires server-side support for PUT requests.');
        return false;
    }
}

// Initialize the application
async function initApp() {
    const coursesLoaded = await loadCourses();
    if (!coursesLoaded) {
        alert('Failed to load course database. Please check your connection and refresh the page.');
        return;
    }

    // Initialize the UI once courses are loaded
    setupEventListeners();
    filterCourses();
    // autoPlaceMandatoryCourses(); // Removed automatic placement
    updateCreditDisplay();
    requestAnimationFrame(updatePlannerPanelHeight);
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
    initApp();
});

function setupEventListeners() {
    // Modal close
    const modal = document.getElementById("courseModal");
    const closeBtn = document.querySelector(".close");
    const importToggleHeader = document.getElementById('toggleImportSchedule');
    if (closeBtn) {
        closeBtn.addEventListener("click", function() {
            modal.style.display = "none";
        });
    }

    // Close modal when clicking outside
    window.addEventListener("click", function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    });

    // Course filters
    const gradeFilter = document.getElementById('gradeFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const searchFilter = document.getElementById('searchFilter');
    const applyImportButton = document.getElementById('applyImportSchedule');
    const exportImportButton = document.getElementById('exportImportSchedule');
    const clearImportButton = document.getElementById('clearImportSchedule');

    if (gradeFilter) {
        gradeFilter.addEventListener('change', filterCourses);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterCourses);
    }
    if (searchFilter) {
        searchFilter.addEventListener('input', filterCourses);
    }
    if (importToggleHeader) {
        importToggleHeader.addEventListener('click', toggleScheduleImportPanel);
        importToggleHeader.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleScheduleImportPanel();
            }
        });
    }
    if (applyImportButton) {
        applyImportButton.addEventListener('click', importScheduleMatrix);
    }
    if (exportImportButton) {
        exportImportButton.addEventListener('click', exportScheduleMatrix);
    }
    if (clearImportButton) {
        clearImportButton.addEventListener('click', () => {
            const importInput = document.getElementById('scheduleImportInput');
            if (importInput) importInput.value = '';
        });
    }

    window.addEventListener('resize', updatePlannerPanelHeight);
}

function toggleScheduleImportPanel() {
    const importPanel = document.getElementById('scheduleImportPanel');
    const toggleHeader = document.getElementById('toggleImportSchedule');

    if (!importPanel || !toggleHeader) {
        return;
    }

    const isHidden = importPanel.hasAttribute('hidden');
    if (isHidden) {
        importPanel.removeAttribute('hidden');
    } else {
        importPanel.setAttribute('hidden', '');
    }

    toggleHeader.setAttribute('aria-expanded', String(isHidden));
    requestAnimationFrame(updatePlannerPanelHeight);
}

function updatePlannerPanelHeight() {
    if (window.innerWidth <= 1024) {
        document.documentElement.style.removeProperty('--planner-panel-height');
        return;
    }

    const scheduleSection = document.querySelector('.schedule-section');
    const scheduleTitle = scheduleSection?.querySelector('h2');
    const importWidget = scheduleSection?.querySelector('.schedule-import-widget');
    const scheduleContainer = scheduleSection?.querySelector('.schedule-container');
    const scheduleTable = scheduleSection?.querySelector('.schedule-table');

    if (!scheduleSection || !scheduleTitle || !scheduleContainer || !scheduleTable) {
        return;
    }

    const sectionStyles = window.getComputedStyle(scheduleSection);
    const titleStyles = window.getComputedStyle(scheduleTitle);
    const containerStyles = window.getComputedStyle(scheduleContainer);

    const sectionVerticalPadding =
        parseFloat(sectionStyles.paddingTop || '0') +
        parseFloat(sectionStyles.paddingBottom || '0');
    const titleBlockHeight =
        scheduleTitle.getBoundingClientRect().height +
        parseFloat(titleStyles.marginBottom || '0');
    const importWidgetHeight = importWidget ? importWidget.getBoundingClientRect().height + 14 : 0;
    const containerChromeHeight =
        parseFloat(containerStyles.paddingTop || '0') +
        parseFloat(containerStyles.paddingBottom || '0') +
        parseFloat(containerStyles.borderTopWidth || '0') +
        parseFloat(containerStyles.borderBottomWidth || '0');
    const tableHeight = scheduleTable.getBoundingClientRect().height;
    const measuredHeight = Math.ceil(sectionVerticalPadding + titleBlockHeight + importWidgetHeight + containerChromeHeight + tableHeight);

    document.documentElement.style.setProperty('--planner-panel-height', `${Math.max(measuredHeight, 320)}px`);
}

function getCourseCategories(course) {
    if (!course || !course.credits || typeof course.credits !== "object") {
        return [];
    }

    return Object.keys(course.credits);
}

function getEligibleGrades(course) {
    if (Array.isArray(course?.eligibleGrades) && course.eligibleGrades.length > 0) {
        return course.eligibleGrades.map(grade => parseInt(grade)).filter(Number.isFinite);
    }

    if (Number.isFinite(course?.grade)) {
        return [course.grade];
    }

    return [];
}

function formatCourseGrade(course) {
    const grades = getEligibleGrades(course);

    if (grades.length === 0) {
        return "";
    }

    if (grades.length === 1) {
        return String(grades[0]);
    }

    return `${Math.min(...grades)}-${Math.max(...grades)}`;
}

function getAllowedSemesters(course) {
    if (course?.length === 'Semester') {
        if (course.lockedSemester) {
            return [course.lockedSemester];
        }

        return ['S1', 'S2'];
    }

    return ['S1', 'S2'];
}

function formatCourseLength(course) {
    if (course?.length === 'Semester' && course.lockedSemester) {
        return `Semester (${course.lockedSemester})`;
    }

    return course?.length || '';
}

function buildCourseSearchText(course) {
    const categories = getCourseCategories(course);

    return [
        course.id,
        course.title,
        course.description,
        course.prerequisites,

        course.length,
        categories.join(" "),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

function renderAvailableCourses(coursesToRender = courses) {
    const coursesList = document.getElementById("coursesList");
    if (!coursesList) return;

    coursesList.innerHTML = "";

    if (coursesToRender.length === 0) {
        coursesList.innerHTML = `
            <div class="no-courses-match">
                <p>No courses match the current filters.</p>
                <p>Try a different grade, category, or search term.</p>
            </div>
        `;
        requestAnimationFrame(updatePlannerPanelHeight);
        return;
    }

    coursesToRender.forEach(course => {
        const courseItem = document.createElement("div");
        courseItem.className = "course-item" + (course.mandatory ? " mandatory" : "");
        courseItem.draggable = true;
        courseItem.dataset.courseId = course.id;
        
        let badge = course.mandatory ? "<span class='course-item-badge'>Mandatory</span>" : "";
        const categories = getCourseCategories(course)
            .map(category => `<span class="course-category-tag">${category}</span>`)
            .join("");
        
        courseItem.innerHTML = `
            <div class="course-item-title">${course.title}</div>
            <div class="course-item-meta">SAS ID ${course.id} · Grade ${formatCourseGrade(course)} · ${formatCourseLength(course)}</div>
            <div class="course-item-categories">${categories}</div>
            ${badge}
        `;

        courseItem.addEventListener("dragstart", function(e) {
            draggedElement = this;
            draggedCourseId = course.id;
            draggedFromSchedule = false;
            dragCompletedInSchedule = false;
            this.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
        });

        courseItem.addEventListener("dragend", function(e) {
            this.classList.remove("dragging");
            clearDragOverStates();
            draggedElement = null;
            draggedCourseId = null;
            draggedFromSchedule = false;
            dragCompletedInSchedule = false;
        });

        courseItem.addEventListener("click", function() {
            openCourseModal(course);
        });

        coursesList.appendChild(courseItem);
    });

    requestAnimationFrame(updatePlannerPanelHeight);
}

function filterCourses() {
    const gradeFilter = document.getElementById('gradeFilter')?.value || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || '';
    const searchFilter = (document.getElementById('searchFilter')?.value || '').trim().toLowerCase();

    const filteredCourses = courses.filter(course => {
        // Grade filter
        if (gradeFilter && !getEligibleGrades(course).includes(parseInt(gradeFilter))) {
            return false;
        }

        // Category filter
        if (categoryFilter) {
            const hasCategory = getCourseCategories(course).includes(categoryFilter);
            if (!hasCategory) {
                return false;
            }
        }

        // Search filter
        if (searchFilter) {
            const searchableText = buildCourseSearchText(course);
            if (!searchableText.includes(searchFilter)) {
                return false;
            }
        }

        return true;
    });

    renderAvailableCourses(filteredCourses);
}

function getCoursePeriods(course) {
    if (!course || !course.credits) {
        return [];
    }

    return Object.entries(creditRequirements)
        .filter(([, requirement]) => course.credits[requirement.name])
        .map(([period]) => parseInt(period));
}

function getScheduleCell(grade, period, semester) {
    return document.querySelector(`.course-cell[data-grade="${grade}"][data-period="${period}"][data-semester="${semester}"]`);
}

function getPlacementElements(placementId) {
    if (!placementId) {
        return [];
    }

    return Array.from(document.querySelectorAll(`.course-in-slot[data-placement-id="${placementId}"]`));
}

function removePlacementGroup(placementId) {
    getPlacementElements(placementId).forEach(element => {
        const parentCell = element.closest('.course-cell');
        element.remove();
        if (parentCell && !parentCell.querySelector('.course-in-slot')) {
            parentCell.classList.remove('year-course-covered');
        }
    });
}

function clearSchedulePlacements() {
    document.querySelectorAll('.course-in-slot').forEach(element => element.remove());
    document.querySelectorAll('.course-cell.year-course-covered').forEach(cell => {
        cell.classList.remove('year-course-covered');
    });
}

const scheduleImportSuffixMap = {
    E: 1,
    SS: 2,
    M: 3,
    S: 4,
    WL: 5,
    VPA: 6,
    PHE: 7,
    TCRC: 8
};

function getScheduleImportPeriodFromSuffix(suffix) {
    return scheduleImportSuffixMap[suffix] || null;
}

function getScheduleImportCategoryName(period) {
    return getCreditRequirementDisplayName(period) || `row ${period}`;
}

function parseScheduleImportToken(token) {
    const normalizedToken = token.trim().toUpperCase();

    if (!normalizedToken || normalizedToken === '-' || normalizedToken === 'EMPTY') {
        return null;
    }

    const suffixedMatch = normalizedToken.match(/^(\d+)G(9|10|11|12)(S1|S2|Y)(E|SS|M|S|VPA|TCRC|PHE|WL)$/);
    if (!suffixedMatch) {
        throw new Error(`Invalid token "${token}". Use formats like 41041G9S1E or 45067G12YVPA.`);
    }

    const suffix = suffixedMatch[4];
    const period = getScheduleImportPeriodFromSuffix(suffix);
    if (!period) {
        throw new Error(`Unknown import suffix "${suffix}" in token "${token}".`);
    }

    return {
        courseId: parseInt(suffixedMatch[1], 10),
        grade: parseInt(suffixedMatch[2], 10),
        semesterCode: suffixedMatch[3],
        period,
        suffix
    };
}

function getScheduleImportTokens(rawText) {
    return rawText.trim().split(/\s+/).filter(Boolean);
}

function getPlacementCellKeys(course, grade, period, semester) {
    return course.length === 'Semester'
        ? [`${grade}-${period}-${semester}`]
        : [`${grade}-${period}-S1`, `${grade}-${period}-S2`];
}

function buildImportPlacement(course, parsedToken, occupiedCells) {
    const normalizedSemester = course.length === 'Semester' ? parsedToken.semesterCode : 'Y';
    const cellKeys = course.length === 'Semester'
        ? [`${parsedToken.grade}-${parsedToken.period}-${normalizedSemester}`]
        : [`${parsedToken.grade}-${parsedToken.period}-S1`, `${parsedToken.grade}-${parsedToken.period}-S2`];

    if (cellKeys.some(key => occupiedCells.has(key))) {
        return null;
    }

    cellKeys.forEach(key => occupiedCells.add(key));
    return {
        course,
        grade: parsedToken.grade,
        semester: normalizedSemester,
        period: parsedToken.period
    };
}

function importScheduleMatrix() {
    const importInput = document.getElementById('scheduleImportInput');
    if (!importInput) {
        return;
    }

    const rawText = importInput.value.trim();
    if (!rawText) {
        showError('Paste a schedule matrix before importing.');
        return;
    }

    const tokens = getScheduleImportTokens(rawText);
    const occupiedCells = new Set();
    const placements = [];

    try {
        for (const token of tokens) {
            const parsedToken = parseScheduleImportToken(token);
            if (!parsedToken) {
                continue;
            }

            const course = courses.find(candidate => candidate.id === parsedToken.courseId);
            if (!course) {
                throw new Error(`Course ${parsedToken.courseId} was not found in the database.`);
            }

            const eligibleGrades = getEligibleGrades(course);
            if (!eligibleGrades.includes(parsedToken.grade)) {
                throw new Error(`${course.title} cannot be imported into Grade ${parsedToken.grade}.`);
            }

            const coursePeriods = getCoursePeriods(course);
            if (!coursePeriods.includes(parsedToken.period)) {
                throw new Error(`${course.title} does not award ${getScheduleImportCategoryName(parsedToken.period)} credit, so it cannot be imported with suffix ${parsedToken.suffix}.`);
            }

            const allowedSemesters = getAllowedSemesters(course);
            if (course.length === 'Semester' && !allowedSemesters.includes(parsedToken.semesterCode)) {
                throw new Error(`${course.title} cannot be imported into ${parsedToken.semesterCode}.`);
            }

            if (course.length !== 'Semester' && parsedToken.semesterCode !== 'Y') {
                throw new Error(`${course.title} is a year course and must use Y instead of ${parsedToken.semesterCode}.`);
            }

            const placement = buildImportPlacement(course, parsedToken, occupiedCells);
            if (placement) {
                placements.push(placement);
            }
        }

        clearSchedulePlacements();

        placements.forEach(({ course, grade, semester, period }) => {
            placeCourseInScheduleAtPeriod(course, grade, period, semester);
        });

        updateCreditDisplay();
    } catch (error) {
        clearSchedulePlacements();
        updateCreditDisplay();
        showError(error.message || 'Import failed.');
    }
}

function getScheduleExportSuffix(period) {
    const suffixMap = {
        1: 'E',
        2: 'SS',
        3: 'M',
        4: 'S',
        5: 'WL',
        6: 'VPA',
        7: 'PHE',
        8: 'TCRC'
    };

    return suffixMap[period] || '';
}

function getCourseSemesterToken(courseElement, course) {
    if (course?.length === 'Semester') {
        return courseElement?.dataset?.semester || 'S1';
    }

    return 'Y';
}

function exportScheduleMatrix() {
    const importInput = document.getElementById('scheduleImportInput');

    if (!importInput) {
        return;
    }

    const placementGroups = new Map();

    document.querySelectorAll('.course-in-slot:not([data-shadow="true"])').forEach(courseElement => {
        const courseId = parseInt(courseElement.dataset.courseId, 10);
        const grade = parseInt(courseElement.dataset.grade || courseElement.closest('.course-cell')?.dataset.grade || '', 10);
        const period = parseInt(courseElement.dataset.period, 10);
        const semester = getCourseSemesterToken(courseElement, courses.find(course => course.id === courseId));
        const key = `${courseId}-${grade}-${period}-${semester}`;

        if (!placementGroups.has(key)) {
            placementGroups.set(key, {
                courseId,
                grade,
                period,
                semester
            });
        }
    });

    const exportedText = Array.from(placementGroups.values())
        .sort((a, b) => a.period - b.period || a.grade - b.grade || a.courseId - b.courseId)
        .map(entry => `${entry.courseId}G${entry.grade}${entry.semester}${getScheduleExportSuffix(entry.period)}`)
        .join(' ');

    importInput.value = exportedText;

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(exportedText).catch(() => {});
    }
}

function clearDragOverStates() {
    document.querySelectorAll('.course-cell.drag-over').forEach(element => {
        element.classList.remove('drag-over');
    });
}

function createPlacementId(courseId) {
    return `placement-${courseId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getTargetSemester(course, eventTarget) {
    return eventTarget?.closest('.course-cell')?.dataset.semester || null;
}

function getPlacementSemester(course, targetSemester) {
    return course?.length === 'Semester' ? targetSemester : 'S1';
}

function getBlockingPlacementInfo(course, grade, semester, movingPlacementId = null) {
    return getCoursePeriods(course)
        .map(period => {
            const semestersToCheck = course.length === 'Semester' ? [semester] : ['S1', 'S2'];
            const blocked = semestersToCheck.some(targetSemester => {
                const cell = getScheduleCell(grade, period, targetSemester);
                const existingCourse = cell?.querySelector('.course-in-slot');
                return existingCourse && existingCourse.dataset.placementId !== movingPlacementId;
            });

            return {
                requirement: creditRequirements[period],
                blocked
            };
        })
        .filter(entry => entry.blocked);
}

function getBlockedPlacementCategories(course, grade, semester, movingPlacementId = null) {
    return getBlockingPlacementInfo(course, grade, semester, movingPlacementId).map(({ requirement }) => requirement.name);
}

function placeCourseInSchedule(course, grade, semester = 'Y', placementId = createPlacementId(course.id)) {
    getCoursePeriods(course).forEach(period => {
        const placementSemester = getPlacementSemester(course, semester);
        const semestersToFill = course.length === 'Semester' ? [placementSemester] : ['S1', 'S2'];

        semestersToFill.forEach(targetSemester => {
            const cell = getScheduleCell(grade, period, targetSemester);
            if (!cell) return;

            const isShadow = course.length !== 'Semester' && targetSemester === 'S2';
            const courseElement = createCourseInSlot(course, placementId, period, targetSemester, isShadow);
            if (isShadow) {
                cell.classList.add('year-course-covered');
            }
            cell.appendChild(courseElement);
        });
    });
}

function placeCourseInScheduleAtPeriod(course, grade, period, semester = 'Y', placementId = createPlacementId(course.id)) {
    const placementSemester = getPlacementSemester(course, semester);
    const semestersToFill = course.length === 'Semester' ? [placementSemester] : ['S1', 'S2'];

    semestersToFill.forEach(targetSemester => {
        const cell = getScheduleCell(grade, period, targetSemester);
        if (!cell) return;

        const isShadow = course.length !== 'Semester' && targetSemester === 'S2';
        const courseElement = createCourseInSlot(course, placementId, period, targetSemester, isShadow);
        if (isShadow) {
            cell.classList.add('year-course-covered');
        }
        cell.appendChild(courseElement);
    });
}

function allowDrop(e) {
    e.preventDefault();
    const cell = e.target.closest(".course-cell");
    if (!cell) return;

    // If we have a dragged course, validate it can be placed here
    if (draggedCourseId) {
        const course = courses.find(c => c.id == draggedCourseId);
        if (course) {
            const period = parseInt(cell.dataset.period);
            const cellGrade = parseInt(cell.dataset.grade);
            const movingPlacementId = draggedElement?.dataset?.placementId || null;
            const compatiblePeriods = getCoursePeriods(course);
            const eligibleGrades = getEligibleGrades(course);
            const targetSemester = getTargetSemester(course, e.target);
            const allowedSemesters = getAllowedSemesters(course);

            // Check category and grade compatibility
            const hasCredits = compatiblePeriods.includes(period);
            const gradeMatches = eligibleGrades.includes(cellGrade);
            const semesterMatches = allowedSemesters.includes(targetSemester);
            const blockedCategories = gradeMatches && semesterMatches
                ? getBlockedPlacementCategories(course, cellGrade, targetSemester, movingPlacementId)
                : [];

            if (hasCredits && gradeMatches && semesterMatches && blockedCategories.length === 0) {
                const semestersToHighlight = course.length === 'Semester' ? [targetSemester] : ['S1', 'S2'];
                semestersToHighlight.forEach(highlightSemester => {
                    getScheduleCell(cellGrade, period, highlightSemester)?.classList.add("drag-over");
                });
                e.dataTransfer.dropEffect = "move";
            } else {
                e.dataTransfer.dropEffect = "none";
            }
        }
    } else {
        // No course being dragged, allow drop for visual feedback
        cell.classList.add("drag-over");
        e.dataTransfer.dropEffect = "move";
    }
}

function showError(message) {
    // Create error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #666666;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        font-weight: bold;
    `;

    document.body.appendChild(errorDiv);

    // Remove after 3 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 3000);
}

function dropCourse(e) {
    e.preventDefault();
    const cell = e.target.closest(".course-cell");
    if (!cell) return;

    cell.classList.remove("drag-over");

    if (!draggedCourseId) return;

    const course = courses.find(c => c.id == draggedCourseId);
    if (!course) return;

    // Validate that course can be placed in this column
    const period = parseInt(cell.dataset.period);
    const categoryName = creditRequirements[period].name;
    const coursePeriods = getCoursePeriods(course);
    if (!coursePeriods.includes(period)) {
        // Show error message
        showError(`Cannot place ${course.title} in ${categoryName} column. This course does not provide credits in that category.`);
        return;
    }

    const targetSemester = getPlacementSemester(course, getTargetSemester(course, e.target));
    const allowedSemesters = getAllowedSemesters(course);
    if (!allowedSemesters.includes(targetSemester)) {
        const semesterText = course.lockedSemester
            ? `${course.lockedSemester} only`
            : 'a valid semester slot';
        showError(`Cannot place ${course.title}. This course must be scheduled in ${semesterText}.`);
        return;
    }

    // Validate that course grade matches the column grade
    const cellGrade = parseInt(cell.dataset.grade);
    if (!getEligibleGrades(course).includes(cellGrade)) {
        // Show error message
        showError(`Cannot place ${course.title} (Grade ${formatCourseGrade(course)}) in Grade ${cellGrade} column. Courses must be placed in an allowed grade level.`);
        return;
    }

    const movingPlacementId = draggedElement?.dataset?.placementId || null;
    const blockedCategories = getBlockedPlacementCategories(course, cellGrade, targetSemester, movingPlacementId);

    if (blockedCategories.length > 0) {
        showError(`Cannot place ${course.title}. The following required slot(s) are already filled for Grade ${cellGrade}: ${blockedCategories.join(', ')}.`);
        return;
    }

    if (movingPlacementId) {
        removePlacementGroup(movingPlacementId);
        placeCourseInSchedule(course, cellGrade, targetSemester, movingPlacementId);
    } else {
        placeCourseInSchedule(course, cellGrade, targetSemester);
    }

    dragCompletedInSchedule = true;
    clearDragOverStates();
    draggedElement = null;
    draggedCourseId = null;
    draggedFromSchedule = false;

    // Update credit display
    updateCreditDisplay();
}

function createCourseInSlot(course, placementId, period, semester, isShadow = false) {
    const courseElement = document.createElement("div");
    const semesterClass = course.length === 'Semester' ? ' semester-course' : ' year-course';
    const shadowClass = isShadow ? ' year-course-shadow' : '';
    courseElement.className = "course-in-slot" + semesterClass + shadowClass + (course.mandatory ? " mandatory" : "");
    courseElement.draggable = !isShadow;
    courseElement.dataset.courseId = course.id;
    courseElement.dataset.placementId = placementId;
    courseElement.dataset.period = period;
    courseElement.dataset.semester = semester;
    courseElement.dataset.shadow = isShadow ? 'true' : 'false';

    courseElement.innerHTML = `
        <div class="course-in-slot-title">${course.title}</div>
        <div class="course-in-slot-id">SAS ID ${course.id}</div>
        <div class="course-in-slot-semester">${course.length === 'Semester' ? semester : 'Year'}</div>
    `;

    if (isShadow) {
        return courseElement;
    }

    courseElement.addEventListener("dragstart", function(e) {
        draggedElement = this;
        draggedCourseId = course.id;
        draggedFromSchedule = true;
        dragCompletedInSchedule = false;
        e.dataTransfer.effectAllowed = "move";
    });

    courseElement.addEventListener("dragend", function(e) {
        clearDragOverStates();

        if (draggedFromSchedule && !dragCompletedInSchedule) {
            removePlacementGroup(placementId);
            updateCreditDisplay();
        }

        draggedElement = null;
        draggedCourseId = null;
        draggedFromSchedule = false;
        dragCompletedInSchedule = false;
    });

    courseElement.addEventListener("click", function() {
        openCourseModal(course);
    });

    // Allow removing from schedule
    courseElement.addEventListener("dblclick", function(e) {
        if (confirm("Remove this course from your schedule?")) {
            removePlacementGroup(placementId);
            updateCreditDisplay();
        }
    });

    return courseElement;
}

function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}
function openCourseModal(course) {
    document.getElementById("modalCourseTitle").textContent = course.title;
    document.getElementById("modalCourseId").textContent = course.id;
    document.getElementById("modalCourseGrade").textContent = "Grade " + formatCourseGrade(course);

    // Format credits display
    let creditsText = "";
    if (course.credits && typeof course.credits === 'object') {
        const creditEntries = Object.entries(course.credits);
        creditsText = creditEntries.map(([category, amount]) => `${amount} ${category}`).join(', ');
    } else {
        creditsText = course.credits || '0';
    }
    document.getElementById("modalCourseCredits").textContent = creditsText;

    document.getElementById("modalCourseLength").textContent = formatCourseLength(course);
    document.getElementById("modalCourseDescription").textContent = course.description;
    document.getElementById("modalCoursePrerequisites").textContent = course.prerequisites;
    if (course.note) {
        document.getElementById("modalCourseNote").textContent = course.note;
        document.getElementById("modalNoteSection").style.display = "block";
    } else {
        document.getElementById("modalNoteSection").style.display = "none";
    }
    document.getElementById("courseModal").style.display = "block";
}

function calculateCredits() {
    const credits = {};

    // Initialize all periods with 0 credits
    for (let period = 1; period <= 8; period++) {
        credits[period] = 0;
    }

    // Calculate credits from placed courses
    for (let grade = 9; grade <= 12; grade++) {
        for (let period = 1; period <= 8; period++) {
            const cell = document.querySelector(`[data-grade="${grade}"][data-period="${period}"]`);
            if (cell) {
                const courseElements = cell.querySelectorAll('.course-in-slot');
                const categoryName = creditRequirements[period].name;

                courseElements.forEach(courseElement => {
                    if (courseElement.dataset.shadow === 'true') {
                        return;
                    }
                    const courseId = parseInt(courseElement.dataset.courseId);
                    const course = courses.find(c => c.id === courseId);
                    if (course && course.credits && course.credits[categoryName]) {
                        credits[period] += course.credits[categoryName];
                    }
                });
            }
        }
    }

    return credits;
}

function checkCreditRequirements() {
    const currentCredits = calculateCredits();
    const warnings = [];
    let totalMet = 0;
    
    // Check credit requirements
    for (let period = 1; period <= 8; period++) {
        const required = creditRequirements[period].required;
        const current = currentCredits[period];
        
        if (current < required) {
            warnings.push(`${creditRequirements[period].name}: ${current}/${required} credits`);
        } else {
            totalMet++;
        }
    }
    
    // Check mandatory courses
    const mandatoryCourses = courses.filter(c => c.mandatory);
    const placedCourses = new Set();
    
    // Collect all placed course IDs
    for (let grade = 9; grade <= 12; grade++) {
        for (let period = 1; period <= 8; period++) {
            const cell = document.querySelector(`[data-grade="${grade}"][data-period="${period}"]`);
            if (cell) {
                const courseElement = cell.querySelector('.course-in-slot');
                if (courseElement) {
                    const courseId = parseInt(courseElement.dataset.courseId);
                    placedCourses.add(courseId);
                }
            }
        }
    }
    
    // Check if all mandatory courses are placed
    const unplacedMandatory = mandatoryCourses.filter(course => !placedCourses.has(course.id));
    if (unplacedMandatory.length > 0) {
        const courseNames = unplacedMandatory.map(c => c.title).join(', ');
        warnings.push(`Mandatory courses not placed: ${courseNames}`);
    }
    
    return { warnings, totalMet, totalRequired: 8 };
}

function updateCreditDisplay() {
    const credits = calculateCredits();
    const { warnings, totalMet, totalRequired } = checkCreditRequirements();
    
    // Update period headers with credit counts
    for (let period = 1; period <= 8; period++) {
        const periodCell = document.querySelector(`tr[data-period="${period}"] .period-cell`);
        if (periodCell) {
            const required = creditRequirements[period].required;
            const current = credits[period];
            const status = current >= required ? 'met' : 'missing';
            const displayName = getCreditRequirementDisplayName(period);
            
            periodCell.innerHTML = `
                <span class="period-name">${displayName}</span>
                <div class="credit-count ${status}">${current}/${required}</div>
            `;
        }
    }
    
    // Update octagon display
    updateOctagonDisplay(credits, totalMet, totalRequired);
    requestAnimationFrame(updatePlannerPanelHeight);
}

function updateOctagonDisplay(credits, totalMet, totalRequired) {
    const octagonElement = document.getElementById('creditOctagon');
    
    // SVG dimensions
    const size = 420;
    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = 140;
    const minRadius = 0;
    
    // Angles for 8-point octagon
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    const categoryNames = [];
    const points = [];
    
    // Calculate point positions and collect category names
    for (let period = 1; period <= 8; period++) {
        const requirement = creditRequirements[period];
        categoryNames.push(requirement.name);
        
        const current = credits[period];
        const required = requirement.required;
        
        // Calculate radius based on 5-point scale (clamped between minRadius and maxRadius)
        const progress = Math.min(current / 5, 1);
        const radius = minRadius + (maxRadius - minRadius) * progress;
        
        // Convert angle to radians (subtract 90 to start from top)
        const angleRad = ((angles[period - 1] - 90) * Math.PI) / 180;
        
        // Calculate point coordinates
        const x = centerX + radius * Math.cos(angleRad);
        const y = centerY + radius * Math.sin(angleRad);
        
        points.push({ x, y, angle: angles[period - 1], period });
    }
    
    // Build SVG
    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${size} ${size}" class="credit-radar-svg">
        <!-- Background grid -->
        <defs>
            <style>
                .radar-line { stroke: #d9d9d9; stroke-width: 1; }
                .radar-point { fill: white; stroke-width: 2; transition: all 0.3s ease; }
                .radar-path { fill: rgba(85, 85, 85, 0.1); stroke: #555555; stroke-width: 2; }
                .radar-center-circle { fill: white; stroke: #555555; stroke-width: 2; }
                .radar-label { font-size: 10px; fill: #555555; text-anchor: middle; pointer-events: none; }
            </style>
        </defs>
        
    `;
    
    // Draw lines from center to each corner
    for (let i = 0; i < 8; i++) {
        const angleRad = ((angles[i] - 90) * Math.PI) / 180;
        const x = centerX + maxRadius * Math.cos(angleRad);
        const y = centerY + maxRadius * Math.sin(angleRad);
        svg += `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" class="radar-line"/>`;
    }
    
    // Draw polygon connecting all points
    let pathData = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        pathData += ` L ${points[i].x} ${points[i].y}`;
    }
    pathData += ' Z'; // Close the path
    svg += `<path d="${pathData}" class="radar-path"/>`;
    
    // Draw points
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const requirement = creditRequirements[point.period];
        const current = credits[point.period];
        const required = requirement.required;
        const isMet = current >= required;
        
        svg += `<circle cx="${point.x}" cy="${point.y}" r="5" class="radar-point" stroke="${isMet ? '#333333' : '#999999'}" fill="${isMet ? '#e8e8e8' : '#f5f5f5'}"/>`;
        
        // Draw label below the point
        const labelAngleRad = ((angles[i] - 90) * Math.PI) / 180;
        const labelRadius = maxRadius + 30;
        const labelX = centerX + labelRadius * Math.cos(labelAngleRad);
        const labelY = centerY + labelRadius * Math.sin(labelAngleRad);
        
        svg += `<text x="${labelX}" y="${labelY + 4}" class="radar-label">${requirement.name}</text>`;
        svg += `<text x="${labelX}" y="${labelY + 16}" class="radar-label" style="font-weight: 600;">${current}/${required}</text>`;
    }
    
    svg += `</svg>`;
    
    octagonElement.innerHTML = svg;
}
