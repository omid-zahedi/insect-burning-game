(() => {
    'use strict';

    const dbName = 'InsectGameDB';
    const storeName = 'playerData';
    const levelRequirements = [0, 500, 1500, 3000, 5000, 7000, 9000, 10000];
    const levelNames = ['مرحله اول', 'مرحله دوم', 'مرحله سوم', 'مرحله چهارم', 'مرحله پنجم', 'مرحله ششم', 'مرحله هفتم', 'مرحله آزاد'];
    const magnifiers = [
        'magnifiers/magnifying1.webp', 'magnifiers/magnifying2.webp', 'magnifiers/magnifying3.webp',
        'magnifiers/magnifying4.webp', 'magnifiers/magnifying5.webp', 'magnifiers/magnifying6.webp',
        'magnifiers/magnifying7.webp', 'magnifiers/magnifying1.webp'
    ];
    const insectsPerLevel = [
        ['ant/1.webp', 'fly/1.webp'],
        ['ant/1.webp', 'fly/1.webp', 'ladybug/1.webp', 'spider/1.webp'],
        ['ant/1.webp', 'fly/1.webp', 'ladybug/1.webp', 'spider/1.webp', 'hornetinvasion/1.webp'],
        ['ant/1.webp', 'fly/1.webp', 'ladybug/1.webp', 'spider/1.webp', 'hornetinvasion/1.webp', 'palomenaprasina/1.webp'],
        ['ant/1.webp', 'fly/1.webp', 'ladybug/1.webp', 'spider/1.webp', 'hornetinvasion/1.webp', 'palomenaprasina/1.webp', 'christmasbeetle/1.webp'],
        ['ant/1.webp', 'fly/1.webp', 'ladybug/1.webp', 'spider/1.webp', 'hornetinvasion/1.webp', 'palomenaprasina/1.webp', 'christmasbeetle/1.webp', 'cetoniaaurata/1.webp'],
        ['ant/1.webp', 'fly/1.webp', 'ladybug/1.webp', 'spider/1.webp', 'hornetinvasion/1.webp', 'palomenaprasina/1.webp', 'christmasbeetle/1.webp', 'cetoniaaurata/1.webp', 'weevilbeetle/1.webp', 'armorcockroach/1.webp'],
        ['ant/1.webp', 'fly/1.webp', 'ladybug/1.webp', 'spider/1.webp', 'hornetinvasion/1.webp', 'palomenaprasina/1.webp', 'christmasbeetle/1.webp', 'cetoniaaurata/1.webp', 'weevilbeetle/1.webp', 'armorcockroach/1.webp']
    ];

    let currentScore = 0;
    let currentLevel = 1;
    let db = null;
    let lastUnlockedLevel = 1; 

    async function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { db = request.result; resolve(db); };
            request.onupgradeneeded = (event) => {
                db = event.target.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id' });
                }
            };
        });
    }

    async function getPlayerData() {
        return new Promise(resolve => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get('player1');
            req.onsuccess = () => resolve(req.result || { id: 'player1', score: 0, level: 1 });
        });
    }

    async function savePlayerData(data) {
        return new Promise(resolve => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            store.put(data);
            tx.oncomplete = resolve;
        });
    }

    function getUnlockedLevelCount() {
        for (let i = levelRequirements.length - 1; i >= 0; i--) {
            if (currentScore >= levelRequirements[i]) {
                return i + 1; 
            }
        }
        return 1;
    }

    function populateLevels() {
        const ul = document.getElementById('levels');
        if (!ul) return;

        ul.innerHTML = ''; 

        for (let i = 1; i <= 8; i++) {
            const unlocked = i === 1 || currentScore >= levelRequirements[i - 1];
            const isActive = currentLevel === i;

            const li = document.createElement('li');
            li.className = unlocked ? 'unlocked' : 'locked';
            if (isActive) li.classList.add('active');

            const topDiv = document.createElement('div');
            topDiv.className = 'level-top';

            const titleSpan = document.createElement('span');
            titleSpan.textContent = levelNames[i - 1];

            const reqSpan = document.createElement('span');
            reqSpan.className = 'req-score';
            reqSpan.textContent = i === 8 ? '100000' : levelRequirements[i - 1].toLocaleString('fa-IR');

            const magImg = document.createElement('img');
            magImg.src = magnifiers[i - 1];
            magImg.className = 'magnifier-img';
            if (!unlocked) magImg.classList.add('grayscaled');

            topDiv.append(titleSpan, reqSpan, magImg);

            const bottomDiv = document.createElement('div');
            bottomDiv.className = 'level-insects';

            insectsPerLevel[i - 1].forEach(path => {
                const img = document.createElement('img');
                img.src = 'insects/' + path;
                img.className = 'insect-icon';
                if (!unlocked) img.classList.add('grayscaled');
                bottomDiv.appendChild(img);
            });

            li.append(topDiv, bottomDiv);

            if (unlocked) {
                li.onclick = () => setLevel(i);
            }

            ul.appendChild(li);
        }

        const activeLi = ul.querySelector(`li:nth-child(${currentLevel})`);
        if (activeLi) {
            ul.querySelectorAll('li').forEach(l => l.classList.remove('active'));
            activeLi.classList.add('active');
        }
    }

    window.increaseScore = async function (points) {
        const previousUnlocked = lastUnlockedLevel;
        currentScore += points;

        const scoreEl = document.getElementById('total-score');
        if (scoreEl) scoreEl.textContent = currentScore.toLocaleString('fa-IR');

        getPlayerData().then(data => {
            data.score = currentScore;
            savePlayerData(data);
        });

        lastUnlockedLevel = getUnlockedLevelCount();
        if (lastUnlockedLevel > previousUnlocked) {
            populateLevels();
        }
    };

    function setLevel(newLevel) {
        if ((newLevel === 1 || currentScore >= levelRequirements[newLevel - 1]) && newLevel >= 1 && newLevel <= 8) {
            currentLevel = newLevel;
            getPlayerData().then(data => {
                data.level = newLevel;
                savePlayerData(data).then(() => location.reload());
            });
        }
    }

    function loadLevelAssets(level) {
        document.querySelectorAll('link[data-stage], script[data-stage]').forEach(el => el.remove());

        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = `style${level}.css`;
        styleLink.dataset.stage = 'true';
        document.head.appendChild(styleLink);

        const script = document.createElement('script');
        script.src = `sidepanel${level}.js`;
        script.dataset.stage = 'true';
        script.onload = () => console.log(`مرحله ${level} لود شد`);
        document.body.appendChild(script);
    }

    function checkLayout() {
        document.body.classList.toggle('split', innerWidth > innerHeight + 100);
    }

    (async () => {
        await initDB();
        const data = await getPlayerData();
        currentScore = data.score || 0;
        currentLevel = data.level || 1;
        lastUnlockedLevel = getUnlockedLevelCount();

        const scoreEl = document.getElementById('total-score');
        if (scoreEl) scoreEl.textContent = currentScore.toLocaleString('fa-IR');

        populateLevels();

        checkLayout();
        loadLevelAssets(currentLevel);

        window.addEventListener('resize', checkLayout);
    })();
})();


document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
}, false);
document.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });
document.addEventListener('touchend', function(e) {
    if (e.touches && e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });