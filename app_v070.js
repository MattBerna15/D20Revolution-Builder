// --- APP.JS VERSION 0.70 ---

// --- SCHEMA VERSIONING & RETROCOMPATIBILITY ---
const CURRENT_SCHEMA_VERSION = 2;
const MASTER_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyTr_FQSheURjctlB8uZQsyCgjUYKwYYD6W98U99CZe-ino6I0q5yMolLwgcR8X_cGp/exec";

// --- NORMALIZATION & SELECTION HELPERS ---
function normalizeFeatureName(name) {
    if (!name) return "";
    return String(name)
        .toLowerCase()
        .replace(/[(),]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isFeatureSelected(feature, selectedFeaturesList, dbMap = {}) {
    if (!feature || !selectedFeaturesList || !Array.isArray(selectedFeaturesList) || selectedFeaturesList.length === 0) {
        return false;
    }

    const targetId = (typeof feature === 'object' && feature !== null && feature.id !== undefined && feature.id !== null && feature.id !== '')
        ? String(feature.id).trim()
        : (typeof feature === 'number' || (typeof feature === 'string' && /^\d+$/.test(feature.trim())) ? String(feature).trim() : null);

    const rawTargetName = (typeof feature === 'object' && feature !== null)
        ? (feature.name || '')
        : String(feature || '');
    const targetNameNorm = normalizeFeatureName(rawTargetName);
    const targetNameClean = rawTargetName.trim().toLowerCase();

    return selectedFeaturesList.some(item => {
        if (item === null || item === undefined) return false;

        let itemId = null;
        let rawItemName = '';

        if (typeof item === 'object') {
            if (item.id !== undefined && item.id !== null && item.id !== '') {
                itemId = String(item.id).trim();
            }
            rawItemName = item.name || '';
        } else if (typeof item === 'number') {
            itemId = String(item);
        } else if (typeof item === 'string') {
            const s = item.trim();
            if (/^\d+$/.test(s)) {
                itemId = s;
            } else {
                rawItemName = s;
            }
        }

        // 1. Direct ID match
        if (targetId && itemId && targetId === itemId) {
            return true;
        }

        // 2. Direct string ID match
        if (targetId && typeof item === 'string' && item.trim() === targetId) {
            return true;
        }

        // 3. Resolve name from dbMap if missing on item
        if (!rawItemName && itemId && dbMap[itemId]) {
            rawItemName = dbMap[itemId].name || '';
        }

        // 4. Exact trimmed lower-case name match
        const itemNameClean = rawItemName.trim().toLowerCase();
        if (targetNameClean && itemNameClean && targetNameClean === itemNameClean) {
            return true;
        }

        // 5. Normalized name match (handles "Expertise, Rogue" vs "Expertise (Rogue)", commas, brackets, whitespace)
        const itemNameNorm = normalizeFeatureName(rawItemName);
        if (targetNameNorm && itemNameNorm && targetNameNorm === itemNameNorm) {
            return true;
        }

        // 6. Direct string comparison for string items
        if (typeof item === 'string') {
            const itemNorm = normalizeFeatureName(item);
            if (targetNameNorm && itemNorm && targetNameNorm === itemNorm) {
                return true;
            }
        }

        return false;
    });
}

// --- DEDUPLICATION HELPERS ---
function deduplicateFeaturesList(list) {
    if (!Array.isArray(list)) return [];
    const seenIds = new Map();
    const seenNames = new Map();
    const result = [];
    for (const item of list) {
        if (item === null || item === undefined) continue;
        let idKey = null;
        let nameKey = null;
        if (typeof item === 'object') {
            if (item.id !== undefined && item.id !== null && item.id !== '') {
                idKey = String(item.id).trim();
            }
            if (typeof item.name === 'string' && item.name.trim()) {
                nameKey = normalizeFeatureName(item.name);
            }
        } else if (typeof item === 'number') {
            idKey = String(item);
        } else if (typeof item === 'string') {
            const s = item.trim();
            if (/^\d+$/.test(s)) {
                idKey = s;
            } else if (s) {
                nameKey = normalizeFeatureName(s);
            }
        }

        const existingItem = (idKey && seenIds.get(idKey)) || (nameKey && seenNames.get(nameKey));
        if (!existingItem) {
            const entry = (typeof item === 'object' && item !== null) ? { ...item } : item;
            if (idKey) seenIds.set(idKey, entry);
            if (nameKey) seenNames.set(nameKey, entry);
            result.push(entry);
        } else if (typeof existingItem !== 'object' && typeof item === 'object' && item !== null) {
            // Upgrade string representation to full object
            const idx = result.indexOf(existingItem);
            if (idx !== -1) {
                result[idx] = { ...item };
                if (idKey) seenIds.set(idKey, result[idx]);
                if (nameKey) seenNames.set(nameKey, result[idx]);
            }
        }
    }
    return result;
}

function deduplicateNamedList(list) {
    if (!Array.isArray(list)) return [];
    const seenIds = new Map();
    const seenNames = new Map();
    const result = [];
    for (const item of list) {
        if (item === null || item === undefined) continue;
        let idKey = null;
        let nameKey = null;
        if (typeof item === 'object') {
            if (item.id !== undefined && item.id !== null && item.id !== '') {
                idKey = String(item.id).trim();
            }
            if (typeof item.name === 'string' && item.name.trim()) {
                nameKey = item.name.trim().toLowerCase();
            }
            if (!idKey && typeof item.className === 'string' && item.className.trim()) {
                nameKey = item.className.trim().toLowerCase();
                idKey = nameKey;
            }
        } else if (typeof item === 'string') {
            const s = item.trim();
            nameKey = s.toLowerCase();
            idKey = s;
        } else {
            idKey = String(item);
        }

        const existingItem = (idKey && seenIds.get(idKey)) || (nameKey && seenNames.get(nameKey));
        if (!existingItem) {
            const entry = (typeof item === 'object' && item !== null) ? { ...item } : item;
            if (idKey) seenIds.set(idKey, entry);
            if (nameKey) seenNames.set(nameKey, entry);
            result.push(entry);
        } else if (typeof existingItem === 'object' && typeof item === 'object') {
            // Merge flags if duplicates have different boolean states
            if (item.isBonus) existingItem.isBonus = true;
            if (item.isFighter) existingItem.isFighter = true;
            if (item.isSorcerer) existingItem.isSorcerer = true;
            if (item.isWarlock) existingItem.isWarlock = true;
            if (item.showProficiency) existingItem.showProficiency = true;
        }
    }
    return result;
}

function deduplicateStringList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];
    for (const item of list) {
        if (item === null || item === undefined) continue;
        const s = String(item).trim();
        const lower = s.toLowerCase();
        if (s && !seen.has(lower)) {
            seen.add(lower);
            result.push(s);
        }
    }
    return result;
}

// --- GLOBAL FEATURE CATALOG & CLASS VALIDATION HELPERS ---
let GLOBAL_FEATURE_CATALOG = null;

function getGlobalFeatureCatalog() {
    if (GLOBAL_FEATURE_CATALOG) return GLOBAL_FEATURE_CATALOG;
    GLOBAL_FEATURE_CATALOG = new Map();
    if (typeof Papa !== 'undefined' && typeof PRELOADED_CSV !== 'undefined') {
        try {
            const parsed = Papa.parse(PRELOADED_CSV, { header: true, skipEmptyLines: true });
            if (parsed && Array.isArray(parsed.data)) {
                parsed.data.forEach(row => {
                    if (!row || !row["Name"]) return;
                    const name = row["Name"].trim();
                    const item = {
                        id: name,
                        name: name,
                        tag: row["Class Tag"] || "Generico",
                        cp: parseInt(row["Creation Points"] || 0),
                        req: parseInt(row["Class Power"] || 0),
                        ap: row["Action Points"] || "-",
                        desc: row["Description"] || "",
                        pre: row["Prerequistes"] || "-"
                    };
                    GLOBAL_FEATURE_CATALOG.set(name.toLowerCase(), item);
                    GLOBAL_FEATURE_CATALOG.set(normalizeFeatureName(name), item);
                });
            }
        } catch (e) {
            console.error("Errore creazione catalogo globale feature:", e);
        }
    }
    return GLOBAL_FEATURE_CATALOG;
}

const LEGACY_FEATURE_NAME_MAP = {
    "expertise (rogue)": "Expertise, Rogue",
    "expertise rogue": "Expertise, Rogue",
    "expertise, rogue": "Expertise, Rogue",
    "expertise (bard)": "Expertise, Bard",
    "expertise bard": "Expertise, Bard",
    "expertise, bard": "Expertise, Bard",
    "expertise (ranger)": "Expertise, Ranger",
    "expertise ranger": "Expertise, Ranger",
    "expertise, ranger": "Expertise, Ranger",
    "rakish audacity": "Rakish Audacity",
    "font of magic": "Font of Magic"
};

function resolveFeatureObject(item, catalogMap) {
    if (item === null || item === undefined) return null;
    // Rifiuta tassativamente indici posizionali di riga o numeri
    if (typeof item === 'number' || (typeof item === 'string' && /^\d+$/.test(item.trim()))) {
        return null;
    }

    const cat = (catalogMap && typeof catalogMap.get === 'function') 
        ? catalogMap 
        : getGlobalFeatureCatalog();

    if (typeof item === 'object') {
        const rawName = (item.name || '').trim();
        if (rawName) {
            const lowerName = rawName.toLowerCase();
            const mappedName = LEGACY_FEATURE_NAME_MAP[lowerName] || rawName;
            const found = cat.get(mappedName.toLowerCase()) || cat.get(normalizeFeatureName(mappedName));
            if (found) return found;
        }
        if (item.tag && item.cp !== undefined) {
            return {
                id: item.name || item.id,
                name: item.name || '',
                tag: item.tag || 'Generico',
                cp: parseInt(item.cp) || 0,
                req: parseInt(item.req) || 0,
                ap: item.ap || '-',
                desc: item.desc || '',
                pre: item.pre || '-'
            };
        }
    } else if (typeof item === 'string') {
        const trimmed = item.trim();
        const lower = trimmed.toLowerCase();
        const mappedName = LEGACY_FEATURE_NAME_MAP[lower] || trimmed;
        return cat.get(mappedName.toLowerCase()) || cat.get(normalizeFeatureName(mappedName)) || null;
    }

    return null;
}

function checkSinglePrereqString(prereqString, featureNamesSet, magicData, spellcastingList = []) {
    const raw = (prereqString || '').trim().toLowerCase();
    if (!raw || raw === '-') return true;

    if (featureNamesSet.has(raw) || featureNamesSet.has(normalizeFeatureName(raw))) return true;

    if (raw === 'spellcasting' || raw === 'spell casting') {
        const hasSlots = (magicData?.casterSlots || []).some(s => s && s.level > 0);
        const hasScClass = (spellcastingList || []).length > 0;
        return hasSlots || hasScClass || featureNamesSet.has('spellcasting') || featureNamesSet.has('spell casting') || featureNamesSet.has('incantesimi');
    }

    if (raw.includes(',')) {
        const subParts = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        return subParts.every(sub => {
            if (sub === 'spellcasting' || sub === 'spell casting') {
                const hasSlots = (magicData?.casterSlots || []).some(s => s && s.level > 0);
                const hasScClass = (spellcastingList || []).length > 0;
                return hasSlots || hasScClass || featureNamesSet.has('spellcasting') || featureNamesSet.has('spell casting');
            }
            return featureNamesSet.has(sub) || featureNamesSet.has(normalizeFeatureName(sub));
        });
    }

    return false;
}

function isFeatureClassAllowed(feature, characterClasses) {
    if (!feature) return false;
    const tag = (feature.tag || '').trim();
    if (!tag || tag.toLowerCase() === 'generico' || tag.toLowerCase() === 'generic' || tag === '-') {
        return true;
    }

    const classesList = Array.isArray(characterClasses) ? characterClasses : [];
    const userClassMap = new Map();
    classesList.forEach(c => {
        if (!c) return;
        const name = String(c.className || c.name || '').trim().toLowerCase();
        if (!name) return;
        const lvl = parseInt(c.level) || 0;
        if (lvl > 0) {
            userClassMap.set(name, Math.max(userClassMap.get(name) || 0, lvl));
            if (name === 'artificier') userClassMap.set('artificer', lvl);
            if (name === 'artificer') userClassMap.set('artificier', lvl);
        }
    });

    const reqLevel = parseInt(feature.req) || 0;
    const tagBranches = tag.split(';').map(b => b.trim()).filter(Boolean);
    if (tagBranches.length === 0) return true;

    const fixedClasses = (typeof FIXED_CLASSES_LIST !== 'undefined' && Array.isArray(FIXED_CLASSES_LIST))
        ? FIXED_CLASSES_LIST
        : ["Artificier", "Barbarian", "Bard", "Blood-Hunter", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Psion", "Ranger", "Rogue", "Sorcerer", "Vampire", "Warlock", "Wizard"];

    return tagBranches.some(branch => {
        const parts = branch.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length === 0) return true;

        const matchedFixedClasses = fixedClasses.filter(cls => {
            const clsLower = cls.toLowerCase();
            return parts.some(p => {
                const pLower = p.toLowerCase();
                return pLower === clsLower || 
                       (clsLower === 'artificier' && pLower === 'artificer') ||
                       (clsLower === 'artificer' && pLower === 'artificier');
            });
        });

        if (matchedFixedClasses.length > 0) {
            return matchedFixedClasses.some(cls => {
                const userLvl = userClassMap.get(cls.toLowerCase()) || 0;
                return userLvl > 0 && userLvl >= reqLevel;
            });
        }

        // Custom / Homebrew class
        return parts.some(p => {
            const userLvl = userClassMap.get(p.toLowerCase()) || 0;
            return userLvl > 0 && userLvl >= reqLevel;
        });
    });
}

function checkFeatureClassRequirement(feature, characterClasses) {
    if (!feature) return { allowed: true, msg: '' };
    const tag = (feature.tag || '').trim();
    if (!tag || tag.toLowerCase() === 'generico' || tag.toLowerCase() === 'generic' || tag === '-') {
        return { allowed: true, msg: '' };
    }

    const classesList = Array.isArray(characterClasses) ? characterClasses : [];
    const userClassMap = new Map();
    classesList.forEach(c => {
        if (!c) return;
        const name = String(c.className || c.name || '').trim().toLowerCase();
        if (!name) return;
        const lvl = parseInt(c.level) || 0;
        if (lvl > 0) {
            userClassMap.set(name, Math.max(userClassMap.get(name) || 0, lvl));
            if (name === 'artificier') userClassMap.set('artificer', lvl);
            if (name === 'artificer') userClassMap.set('artificier', lvl);
        }
    });

    const reqLevel = parseInt(feature.req) || 0;
    const tagBranches = tag.split(';').map(b => b.trim()).filter(Boolean);
    if (tagBranches.length === 0) return { allowed: true, msg: '' };

    let anyBranchAllowed = false;
    let missingMsgs = [];

    const fixedClasses = (typeof FIXED_CLASSES_LIST !== 'undefined' && Array.isArray(FIXED_CLASSES_LIST))
        ? FIXED_CLASSES_LIST
        : ["Artificier", "Barbarian", "Bard", "Blood-Hunter", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Psion", "Ranger", "Rogue", "Sorcerer", "Vampire", "Warlock", "Wizard"];

    tagBranches.forEach(branch => {
        const parts = branch.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length === 0) {
            anyBranchAllowed = true;
            return;
        }

        const matchedFixedClasses = fixedClasses.filter(cls => {
            const clsLower = cls.toLowerCase();
            return parts.some(p => {
                const pLower = p.toLowerCase();
                return pLower === clsLower || 
                       (clsLower === 'artificier' && pLower === 'artificer') ||
                       (clsLower === 'artificer' && pLower === 'artificier');
            });
        });

        if (matchedFixedClasses.length > 0) {
            const hasClassAndLevel = matchedFixedClasses.some(cls => {
                const userLvl = userClassMap.get(cls.toLowerCase()) || 0;
                return userLvl > 0 && userLvl >= reqLevel;
            });
            if (hasClassAndLevel) {
                anyBranchAllowed = true;
            } else {
                const classLabel = matchedFixedClasses.join(' o ');
                missingMsgs.push(reqLevel > 0 ? `Richiede ${classLabel} Lv. ${reqLevel}` : `Richiede ${classLabel}`);
            }
        } else {
            const hasCustom = parts.some(p => {
                const userLvl = userClassMap.get(p.toLowerCase()) || 0;
                return userLvl > 0 && userLvl >= reqLevel;
            });
            if (hasCustom) {
                anyBranchAllowed = true;
            } else {
                const label = parts[parts.length - 1] || parts[0];
                missingMsgs.push(reqLevel > 0 ? `Richiede ${label} Lv. ${reqLevel}` : `Richiede ${label}`);
            }
        }
    });

    if (anyBranchAllowed) {
        return { allowed: true, msg: '' };
    }
    return { allowed: false, msg: missingMsgs[0] || 'Prerequisiti di classe non soddisfatti' };
}

function areFeaturePrereqsMet(feature, activeNamesSet, magicData, spellcastingList) {
    if (!feature || !feature.pre || feature.pre === '-' || feature.pre.trim() === '') {
        return true;
    }
    const parts = feature.pre.split(';').map(p => p.trim()).filter(Boolean);
    return parts.every(part => checkSinglePrereqString(part, activeNamesSet, magicData, spellcastingList));
}

function pruneInvalidFeatures(featuresList, classesList, magicData, spellcastingList, catalogMap) {
    if (!Array.isArray(featuresList)) return [];

    let currentList = featuresList.map(item => resolveFeatureObject(item, catalogMap)).filter(Boolean);
    currentList = deduplicateFeaturesList(currentList);

    while (true) {
        let changed = false;

        const activeNamesSet = new Set();
        currentList.forEach(item => {
            if (item && item.name) {
                activeNamesSet.add(item.name.trim().toLowerCase());
                activeNamesSet.add(normalizeFeatureName(item.name));
            }
        });

        const nextList = [];
        for (const feat of currentList) {
            // 1. Controllo appartenenza di classe e livello
            if (!isFeatureClassAllowed(feat, classesList)) {
                changed = true;
                continue;
            }

            // 2. Controllo prerequisiti di abilità propedeutiche (f.pre)
            const otherNamesSet = new Set();
            currentList.forEach(other => {
                if (other.name && feat.name && other.name.trim().toLowerCase() !== feat.name.trim().toLowerCase()) {
                    otherNamesSet.add(other.name.trim().toLowerCase());
                    otherNamesSet.add(normalizeFeatureName(other.name));
                }
            });

            if (!areFeaturePrereqsMet(feat, otherNamesSet, magicData, spellcastingList)) {
                changed = true;
                continue;
            }

            nextList.push(feat);
        }

        currentList = nextList;
        if (!changed) break;
    }

    // Restituisce l'array pulito di nomi univoci canonici (stringhe)
    return currentList.map(f => f.name.trim());
}

function migrateAndSanitizeCharacter(raw) {
    if (!raw || typeof raw !== 'object') {
        raw = {};
    }

    // Handle legacy / aliased keys
    const rawFeatures = raw.features || raw.selectedFeatures || [];
    const rawFeats = raw.feats || raw.selectedFeats || [];
    const rawFightingStyles = raw.fightingStyles || raw.selectedFightingStyles || [];
    const rawManeuvers = raw.maneuvers || raw.martialManeuvers || raw.battleManeuvers || raw.selectedManeuvers || [];
    const rawCunningStrikes = raw.cunningStrikes || raw.selectedCunningStrikes || [];
    const rawMetamagic = raw.metamagic || raw.selectedMetamagic || [];
    const rawInvocations = raw.invocations || raw.eldritchInvocations || raw.supplicheOcculte || raw.selectedInvocations || [];
    const rawPsionicPowers = raw.psionicPowers || raw.poteriPsionici || raw.selectedPsionicPowers || [];
    const rawPsionicDisciplines = raw.psionicDisciplines || raw.disciplinePsioniche || raw.selectedPsionicDisciplines || [];
    const rawSpellcasting = raw.spellcasting || raw.selectedSpellcasting || [];
    const rawClasses = Array.isArray(raw.classes) 
        ? raw.classes 
        : (Array.isArray(raw.homebrewClasses) ? raw.homebrewClasses : []);

    // 1. Stats normalization
    const defaultStat = () => ({ base: 8, race: 0, feat: 0, ability: 0, misc: 0 });
    const rawStats = (raw.stats && typeof raw.stats === 'object') ? raw.stats : {};
    const sanitizedStats = {};
    ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].forEach(statKey => {
        const s = rawStats[statKey];
        if (s && typeof s === 'object') {
            sanitizedStats[statKey] = {
                base: parseInt(s.base) || 8,
                race: parseInt(s.race) || 0,
                feat: parseInt(s.feat) || 0,
                ability: parseInt(s.ability) || 0,
                misc: parseInt(s.misc) || 0
            };
        } else {
            sanitizedStats[statKey] = defaultStat();
        }
    });

    // 2. Power Level
    const sanitizedCharPower = {
        level: Math.max(1, parseInt(raw.charPower?.level) || 1),
        cpPerLevel: (typeof raw.charPower?.cpPerLevel === 'number') 
            ? raw.charPower.cpPerLevel 
            : (parseFloat(raw.charPower?.cpPerLevel) || 12.5)
    };

    // 3. Classes normalization (deduplicated by className)
    const sanitizedClasses = deduplicateNamedList(rawClasses.map(c => ({
        className: (c ? (c.className || c.name || '') : '').trim(),
        level: Math.max(1, parseInt(c?.level) || 1),
        showProficiency: !!c?.showProficiency,
        selectedHp: (typeof c?.selectedHp === 'number' && !isNaN(c.selectedHp)) ? c.selectedHp : undefined
    })).filter(c => c.className));

    // 4. Feats normalization (deduplicated)
    const sanitizedFeats = deduplicateNamedList((Array.isArray(rawFeats) ? rawFeats : []).map(f => {
        if (typeof f === 'object' && f !== null) {
            return {
                ...f,
                cost: parseInt(f.cost) || 0,
                isBonus: !!f.isBonus
            };
        }
        return { id: f, name: String(f), cost: 0, isBonus: false };
    }));

    // 5. Saving Throws
    const rawST = (raw.savingThrows && typeof raw.savingThrows === 'object') ? raw.savingThrows : {};
    const sanitizedSavingThrows = {
        STR: !!rawST.STR,
        DEX: !!rawST.DEX,
        CON: !!rawST.CON,
        INT: !!rawST.INT,
        WIS: !!rawST.WIS,
        CHA: !!rawST.CHA
    };

    // 6. Magic
    const rawMagic = (raw.magic && typeof raw.magic === 'object') ? raw.magic : {};
    const sanitizedMagic = {
        extraSpells: parseInt(rawMagic.extraSpells) || 0,
        extraSlots: parseInt(rawMagic.extraSlots) || 0,
        slotAsMana: !!rawMagic.slotAsMana,
        casterSlots: Array.isArray(rawMagic.casterSlots) ? rawMagic.casterSlots : []
    };

    // 7. Lists (tutti deduplicati e sanificati rigorosamente con pruning automatico delle feature orfane)
    const sanitizedFeatures = pruneInvalidFeatures(rawFeatures, sanitizedClasses, sanitizedMagic, rawSpellcasting);
    const sanitizedFightingStyles = deduplicateNamedList(rawFightingStyles);
    const sanitizedManeuvers = deduplicateNamedList(rawManeuvers);
    const sanitizedCunningStrikes = deduplicateNamedList(rawCunningStrikes);
    const sanitizedMetamagic = deduplicateNamedList(rawMetamagic);
    const sanitizedPsionicPowers = deduplicateNamedList(rawPsionicPowers);
    const sanitizedPsionicDisciplines = deduplicateNamedList(rawPsionicDisciplines);
    const sanitizedInvocations = deduplicateNamedList(rawInvocations);
    const sanitizedSpellcasting = deduplicateStringList(rawSpellcasting);

    // 8. Skills
    const sanitizedSkills = (raw.skills && typeof raw.skills === 'object' && !Array.isArray(raw.skills)) ? { ...raw.skills } : {};
    if (Array.isArray(raw.selectedSkills)) {
        raw.selectedSkills.forEach(sName => {
            if (sName && typeof sName === 'string') {
                sanitizedSkills[sName] = sanitizedSkills[sName] || { isProficient: true, isClassSkill: false, isExpert: false };
                sanitizedSkills[sName].isProficient = true;
            }
        });
    }

    // 9. Meta
    const rawMeta = (raw.meta && typeof raw.meta === 'object') ? raw.meta : {};
    const sanitizedMeta = {
        themeColor: rawMeta.themeColor || 'blue',
        ...rawMeta
    };

    return {
        ...raw,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        _migratedFrom: raw.schemaVersion || 1,
        stats: sanitizedStats,
        charPower: sanitizedCharPower,
        classes: sanitizedClasses,
        feats: sanitizedFeats,
        savingThrows: sanitizedSavingThrows,
        magic: sanitizedMagic,
        features: sanitizedFeatures,
        selectedFeatures: sanitizedFeatures,
        fightingStyles: sanitizedFightingStyles,
        maneuvers: sanitizedManeuvers,
        cunningStrikes: sanitizedCunningStrikes,
        metamagic: sanitizedMetamagic,
        psionicPowers: sanitizedPsionicPowers,
        psionicDisciplines: sanitizedPsionicDisciplines,
        invocations: sanitizedInvocations,
        spellcasting: sanitizedSpellcasting,
        skills: sanitizedSkills,
        meta: sanitizedMeta
    };
}

function calculateCharacterCPSpent(p, dbMap = {}, rawProfMap = {}) {
    if (!p) return 0;
    
    // 1. Feats (deduplicated)
    const uniqueFeats = deduplicateNamedList(p.feats || []);
    const featCosts = uniqueFeats.reduce((acc, f) => acc + (f.isBonus ? 0 : (parseInt(f.cost) || 0)), 0);

    // 2. Classes (level + proficiency cost, deduplicated)
    const uniqueClasses = deduplicateNamedList(p.classes || []);
    const classCosts = uniqueClasses.reduce((acc, c) => {
        let cost = parseInt(c.level) || 0;
        if (c.showProficiency) {
            const prof = rawProfMap[c.className];
            if (prof) cost += parseInt(prof.cost) || 0;
        }
        return acc + cost;
    }, 0);

    // 3. Ability scores
    const abilityScoreCost = ((p.stats ? Object.values(p.stats).reduce((acc, s) => acc + ((s && parseInt(s.ability)) || 0), 0) : 0) * 2);

    // 4. HP Upgrade costs
    const calculateSingleHpCostRaw = (base, current) => {
        if (current <= base) return 0;
        let cost = 0;
        for (let v = base + 1; v <= current; v++) {
            cost += (v <= 6) ? 1 : 2;
        }
        return cost;
    };
    const hpCosts = uniqueClasses.reduce((acc, c) => {
        if (!c.showProficiency) return acc;
        let base = 0;
        const prof = rawProfMap[c.className];
        if (prof && prof.desc) {
            const match = prof.desc.match(/(\d+)pf/i);
            if (match) base = parseInt(match[1]);
        }
        const current = c.selectedHp || base;
        return acc + calculateSingleHpCostRaw(base, current);
    }, 0);

    // 5. Skills
    const skillCosts = (() => {
        let count = 0;
        if (typeof SKILLS_DATA !== 'undefined' && Array.isArray(SKILLS_DATA)) {
            SKILLS_DATA.forEach(skill => {
                const s = p.skills?.[skill.name];
                if (s && s.isProficient && !s.isClassSkill) count++;
            });
        }
        return Math.max(0, count - 1);
    })();

    // 6. Fighting Styles (deduplicated)
    const uniqueFS = deduplicateNamedList(p.fightingStyles || []);
    const fsCosts = uniqueFS.length * 3;

    // 7. Martial Maneuvers (deduplicated)
    const uniqueManeuvers = deduplicateNamedList(p.maneuvers || []);
    const maneuverCosts = uniqueManeuvers.reduce((acc, item) => {
        if (typeof item === 'string') return acc + 3;
        return acc + (item.isFighter ? 0 : 3);
    }, 0);

    // 8. Cunning Strikes (deduplicated)
    const uniqueCS = deduplicateNamedList(p.cunningStrikes || []);
    const csCosts = uniqueCS.length * 2;

    // 9. Metamagic (deduplicated)
    const uniqueMM = deduplicateNamedList(p.metamagic || []);
    const mmCosts = uniqueMM.reduce((acc, item) => {
        if (typeof item === 'string') return acc + 2;
        return acc + (item.isSorcerer ? 0 : 2);
    }, 0);

    // 10. Eldritch Invocations (deduplicated)
    const uniqueInvocations = deduplicateNamedList(p.invocations || []);
    const eldritchCosts = uniqueInvocations.reduce((acc, item) => {
        if (typeof item === 'string') return acc + 3;
        return acc + (item.isWarlock ? 0 : 3);
    }, 0);

    // 11. Psionic Powers & Disciplines (deduplicated)
    const uniqueFeatures = deduplicateFeaturesList(p.features || p.selectedFeatures || []);
    const hasPsiPower = uniqueFeatures.some(f => {
        const fObj = (typeof f === 'object') ? f : (dbMap[f] || (typeof f === 'string' ? dbMap[f.trim().toLowerCase()] : null));
        return fObj && fObj.name && fObj.name.trim().toLowerCase() === 'psionic power';
    });
    const hasPsiDisc = uniqueFeatures.some(f => {
        const fObj = (typeof f === 'object') ? f : (dbMap[f] || (typeof f === 'string' ? dbMap[f.trim().toLowerCase()] : null));
        return fObj && fObj.name && fObj.name.trim().toLowerCase() === 'psionic discipline';
    });
    const uniquePsiPowers = deduplicateNamedList(p.psionicPowers || []);
    const psiCosts = hasPsiPower ? uniquePsiPowers.reduce((acc, item) => {
        const cost = (typeof item === 'object' && item.cost !== undefined) ? parseInt(item.cost) : 2;
        return acc + (isNaN(cost) ? 2 : cost);
    }, 0) : 0;
    const uniquePsiDisc = deduplicateNamedList(p.psionicDisciplines || []);
    const psiDiscCosts = hasPsiDisc ? uniquePsiDisc.reduce((acc, item) => {
        const cost = (typeof item === 'object' && item.cost !== undefined) ? parseInt(item.cost) : 2;
        return acc + (isNaN(cost) ? 2 : cost);
    }, 0) : 0;

    // 12. Magic & Spellcasting (deduplicated)
    const magicCosts = (() => {
        const m = p.magic || { extraSpells: 0, extraSlots: 0, slotAsMana: false };
        let b = (m.extraSpells || 0) * 1 + (m.extraSlots || 0) * 10 + (m.slotAsMana ? 10 : 0);
        const uniqueSC = deduplicateStringList(p.spellcasting || []);
        const scCosts = uniqueSC.reduce((acc, scName) => {
            if (typeof SPELLCASTING_DATA !== 'undefined' && Array.isArray(SPELLCASTING_DATA)) {
                const sc = SPELLCASTING_DATA.find(s => s.name === scName);
                return acc + (sc ? sc.cost : 0);
            }
            return acc;
        }, 0);
        const slotT = ['full', 'full', 'half', 'half', 'third', 'third'];
        const casterLvlCosts = (m.casterSlots || []).reduce((acc, slot, idx) => {
            if (!slot || !slot.active) return acc;
            const type = slotT[idx];
            let lvl = slot.level;
            if (type === 'half') lvl = Math.ceil(lvl / 2);
            else if (type === 'third') lvl = Math.floor(lvl / 3);
            return acc + lvl;
        }, 0);
        return b + scCosts + casterLvlCosts;
    })();

    // 13. Features (deduplicated & validated)
    const cat = (dbMap && Object.keys(dbMap).length > 0) ? dbMap : getGlobalFeatureCatalog();
    const featCostList = uniqueFeatures.reduce((acc, feat) => {
        const f = resolveFeatureObject(feat, cat);
        if (!f) return acc;
        if (!isFeatureClassAllowed(f, p.classes)) return acc;
        return acc + (parseInt(f.cp) || 0);
    }, 0);

    return featCostList + classCosts + featCosts + abilityScoreCost + hpCosts + skillCosts + fsCosts + maneuverCosts + csCosts + mmCosts + eldritchCosts + psiCosts + psiDiscCosts + magicCosts;
}

if (typeof window !== 'undefined') {
    window.normalizeFeatureName = normalizeFeatureName;
    window.isFeatureSelected = isFeatureSelected;
    window.deduplicateFeaturesList = deduplicateFeaturesList;
    window.deduplicateNamedList = deduplicateNamedList;
    window.deduplicateStringList = deduplicateStringList;
    window.migrateAndSanitizeCharacter = migrateAndSanitizeCharacter;
    window.calculateCharacterCPSpent = calculateCharacterCPSpent;
    window.isFeatureClassAllowed = isFeatureClassAllowed;
    window.checkFeatureClassRequirement = checkFeatureClassRequirement;
    window.pruneInvalidFeatures = pruneInvalidFeatures;
    window.getGlobalFeatureCatalog = getGlobalFeatureCatalog;
}

function App() {
    // VIEW STATE
    const [view, setView] = React.useState('lobby'); // 'lobby' or 'editor'

    // DATABASE STATES
    const [db, setDb] = React.useState([]);
    const [featsDb, setFeatsDb] = React.useState([]);
    const [proficiencyDb, setProficiencyDb] = React.useState([]);
    const [fightingStylesDb, setFightingStylesDb] = React.useState([]);
    const [maneuversDb, setManeuversDb] = React.useState([]);
    const [cunningStrikesDb, setCunningStrikesDb] = React.useState([]);
    const [metamagicDb, setMetamagicDb] = React.useState([]);
    const [psionicPowersDb, setPsionicPowersDb] = React.useState([]);
    const [psionicPowerSelection, setPsionicPowerSelection] = React.useState('');
    const [psionicDisciplinesDb, setPsionicDisciplinesDb] = React.useState([]);
    const [psionicDisciplineSelection, setPsionicDisciplineSelection] = React.useState('');
    const [maneuverSelection, setManeuverSelection] = React.useState('');
    const [invocationsDb, setInvocationsDb] = React.useState([]);
    const [invocationSelection, setInvocationSelection] = React.useState('');

    // MEMOIZED MAPS
    const dbMap = React.useMemo(() => {
        if (!db) return {};
        return db.reduce((acc, item) => { 
            if (item && item.name) {
                const name = item.name.trim();
                acc[name] = item;
                acc[name.toLowerCase()] = item;
                acc[normalizeFeatureName(name)] = item;
                if (item.id) acc[item.id] = item;
            }
            return acc; 
        }, {});
    }, [db]);

    const featsMap = React.useMemo(() => {
        if (!featsDb) return {};
        return featsDb.reduce((acc, item) => { 
            if (item && item.id) acc[item.id] = item; 
            return acc; 
        }, {});
    }, [featsDb]);
    
    const fightingStylesMap = React.useMemo(() => {
        if (!fightingStylesDb) return {};
        return fightingStylesDb.reduce((acc, item) => {
            if (item && item.id) acc[item.id] = item;
            return acc;
        }, {});
    }, [fightingStylesDb]);
    
    const cunningStrikesMap = React.useMemo(() => {
        if (!cunningStrikesDb) return {};
        return cunningStrikesDb.reduce((acc, item) => {
            if (item && item.id) acc[item.id] = item;
            return acc;
        }, {});
    }, [cunningStrikesDb]);

    const psionicPowersMap = React.useMemo(() => {
        if (!psionicPowersDb) return {};
        return psionicPowersDb.reduce((acc, item) => {
            if (item && item.id) acc[item.id] = item;
            return acc;
        }, {});
    }, [psionicPowersDb]);

    const psionicDisciplinesMap = React.useMemo(() => {
        if (!psionicDisciplinesDb) return {};
        return psionicDisciplinesDb.reduce((acc, item) => {
            if (item && item.id) acc[item.id] = item;
            return acc;
        }, {});
    }, [psionicDisciplinesDb]);

    const maneuversMap = React.useMemo(() => {
        if (!maneuversDb) return {};
        return maneuversDb.reduce((acc, item) => {
            if (item && item.id) acc[item.id] = item;
            return acc;
        }, {});
    }, [maneuversDb]);

    const metamagicMap = React.useMemo(() => {
        if (!metamagicDb) return {};
        return metamagicDb.reduce((acc, item) => {
            if (item && item.id) acc[item.id] = item;
            return acc;
        }, {});
    }, [metamagicDb]);
    
    const invocationsMap = React.useMemo(() => {
        if (!invocationsDb) return {};
        return invocationsDb.reduce((acc, item) => {
            if (item && item.id) acc[item.id] = item;
            return acc;
        }, {});
    }, [invocationsDb]);

    const proficiencyMap = React.useMemo(() => {
        if (!proficiencyDb) return {};
        return proficiencyDb.reduce((acc, item) => { 
            if (item && item.className) acc[item.className] = item; 
            return acc; 
        }, {});
    }, [proficiencyDb]);

    // UI STATES
    const [selectedClassFilter, setSelectedClassFilter] = React.useState("all");
    const [selectedTags, setSelectedTags] = React.useState([]); 
    const [search, setSearch] = React.useState('');
    const [activeTab, setActiveTab] = React.useState('basic'); 
    const [showImport, setShowImport] = React.useState(false);
    const [csvText, setCsvText] = React.useState('');
    const [importType, setImportType] = React.useState('features'); 
    const [showSelectedOnly, setShowSelectedOnly] = React.useState(false);

    // PROFILES
    const [profiles, setProfiles] = React.useState(['Personaggio 1']);
    const [currentProfile, setCurrentProfile] = React.useState('Personaggio 1');

    // CURRENT CHARACTER STATE
    const [charData, setCharData] = React.useState(() => migrateAndSanitizeCharacter({}));

    // FEAT SELECTION TEMP STATE
    const [featSelection, setFeatSelection] = React.useState("");
    const [fightingStyleSelection, setFightingStyleSelection] = React.useState("");
    const [cunningStrikeSelection, setCunningStrikeSelection] = React.useState("");
    const [metamagicSelection, setMetamagicSelection] = React.useState("");
    
    // REFS
    const fileInputRef = React.useRef(null);
    const csvFileInputRef = React.useRef(null);

    // TOASTS STATE
    const [toasts, setToasts] = React.useState([]);
    const showToast = React.useCallback((text, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, text, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    // CUSTOM MODALS STATE
    const [confirmModal, setConfirmModal] = React.useState(null);
    const [alertModal, setAlertModal] = React.useState(null);
    
    // CUSTOM PROFILE MANAGEMENT MODALS STATE
    const [createModal, setCreateModal] = React.useState(null); // { name, level, cpPerLevel, themeColor }
    const [renameModal, setRenameModal] = React.useState(null); // { oldName, name }
    const [duplicateModal, setDuplicateModal] = React.useState(null); // { sourceName, name }
    const [importPreviewModal, setImportPreviewModal] = React.useState(null); // { type, name, level, classesText, rawData, isConflict, importName, overwrite }
    const [sendToMasterModal, setSendToMasterModal] = React.useState(null); // { targetProfile, playerName }
    const [isSubmittingToMaster, setIsSubmittingToMaster] = React.useState(false);

    // THEME COLORS DATA
    const THEME_COLORS = [
        { key: 'blue', label: 'Zaffiro', bg: 'bg-blue-600', border: 'border-blue-500', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
        { key: 'amber', label: 'Ambra', bg: 'bg-amber-600', border: 'border-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
        { key: 'emerald', label: 'Smeraldo', bg: 'bg-emerald-600', border: 'border-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
        { key: 'purple', label: 'Ametista', bg: 'bg-purple-600', border: 'border-purple-500', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
        { key: 'rose', label: 'Rubino', bg: 'bg-rose-600', border: 'border-rose-500', text: 'text-rose-400', glow: 'shadow-rose-500/20' },
        { key: 'indigo', label: 'Indaco', bg: 'bg-indigo-600', border: 'border-indigo-500', text: 'text-indigo-400', glow: 'shadow-indigo-500/20' }
    ];

    const getThemeColor = (key) => THEME_COLORS.find(c => c.key === key) || THEME_COLORS[0];

    const formatFeatureDesc = React.useCallback((text) => {
        if (!text) return '';
        return text
            .replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="text-slate-200"><em>$1</em></strong>')
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-200">$1</strong>')
            .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    }, []);

    // --- OPTIMIZED HELPERS (Callbacks) ---
    const getHpPerLevel = React.useCallback((className) => {
        const prof = proficiencyMap[className];
        if (!prof || !prof.desc) return 0; 
        const match = prof.desc.match(/(\d+)pf/i);
        return match ? parseInt(match[1]) : 0;
    }, [proficiencyMap]);
    
    const calculateSingleHpCost = React.useCallback((base, current) => {
        if (current <= base) return 0;
        let cost = 0;
        for (let v = base + 1; v <= current; v++) {
            cost += (v <= 6) ? 1 : 2;
        }
        return cost;
    }, []);

    const getAbilityMod = (score) => Math.floor((score - 10) / 2);
    const getProficiencyBonus = (level) => Math.ceil(1 + (level / 4));
    
    // --- PARSERS ---
    const parseFeaturesCSV = (text) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const newItems = results.data.map((row) => {
                    if (!row["Name"]) return null; 
                    const name = row["Name"].trim();
                    return {
                        id: name, 
                        name: name,
                        tag: row["Class Tag"] || "Generico",
                        cp: parseInt(row["Creation Points"] || 0),
                        req: parseInt(row["Class Power"] || 0),
                        ap: row["Action Points"] || "-",
                        desc: row["Description"] || "",
                        pre: row["Prerequistes"] || "-" 
                    };
                }).filter(Boolean);
                setDb(newItems);
            }
        });
    };

    const parseFeatsCSV = (text) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const parsedFeats = results.data.map((row, index) => {
                     if (!row["Feat"]) return null;
                     return {
                         id: `feat_${index}`,
                         name: row["Feat"],
                         prereq: row["Prerequisite"] || "-",
                         desc: row["Description"] || "",
                         cost: parseInt(row["Cost"] || 0),
                         action: row["Action Type"] || "-",
                         isBonus: false
                     };
                }).filter(Boolean);
                setFeatsDb(parsedFeats);
            }
        });
    };

    const parseFightingStylesCSV = (text) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                 const styles = results.data.map((row, index) => ({
                     id: `fs_${index}`,
                     name: row["Name"],
                     action: row["Action"] || "None",
                     desc: row["Description"],
                     cost: 3
                 })).filter(s => s.name);
                 setFightingStylesDb(styles);
            }
        });
    };

    const parseManeuversCSV = (text) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                 const items = results.data.map((row, index) => ({
                     id: `maneuver_${index}`,
                     name: row["Name"] || "",
                     action: row["Action"] || "Passiva",
                     desc: row["Description"] || "",
                     cost: 3
                 })).filter(s => s.name);
                 setManeuversDb(items);
            }
        });
    };
    
    const parseCunningStrikesCSV = (text) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                 const items = results.data.map((row, index) => ({
                     id: `cs_${index}`,
                     name: row["Name"],
                     costDice: row["Sneak Dice"] || "-",
                     desc: row["Description"],
                     cpCost: 2
                 })).filter(s => s.name);
                 setCunningStrikesDb(items);
            }
        });
    };

    const parseMetamagicCSV = (text) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                 const items = results.data.map((row, index) => ({
                     id: `mm_${index}`,
                     name: row["Metamagic Feat"] || row["Name"],
                     spCost: row["Sorcere Point"] || row["SP Cost"] || "-",
                     desc: row["Description"],
                     cpCost: 2
                 })).filter(s => s.name);
                 setMetamagicDb(items);
            }
        });
    };

    const parsePsionicPowersCSV = (text) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                 const items = results.data.map((row, index) => ({
                     id: `psi_${index}`,
                     name: row["Name"] || '',
                     action: row["Action"] || '1 AP',
                     cost: parseInt(row["Cost"] || 2),
                     desc: row["Description"] || ''
                 })).filter(s => s.name);
                 setPsionicPowersDb(items);
            }
        });
    };

    const parsePsionicDisciplinesCSV = (text) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                 const items = results.data.map((row, index) => ({
                     id: `pdisc_${index}`,
                     name: row["Name"] || '',
                     action: row["Action"] || 'Passive',
                     cost: parseInt(row["Cost"] || 2),
                     desc: row["Description"] || ''
                 })).filter(s => s.name);
                 setPsionicDisciplinesDb(items);
            }
        });
    };

    const parseInvocationsCSV = (text) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                 const items = results.data.map((row, index) => ({
                     id: `invocation_${index}`,
                     name: (row["Name"] || "").trim(),
                     action: (row["Action"] || "Passiva").trim(),
                     desc: (row["Description"] || "").trim(),
                     cost: 3
                 })).filter(s => s.name);
                 setInvocationsDb(items);
            }
        });
    };
    
    // --- INITIALIZATION ---
    React.useEffect(() => {
        // Pulizia cache vecchi DB
        localStorage.removeItem('d20_db_data');
        localStorage.removeItem('d20_feats_db');
        localStorage.removeItem('d20_fighting_styles_db');
        localStorage.removeItem('d20_maneuvers_db');
        localStorage.removeItem('d20_cunning_strikes_db');
        localStorage.removeItem('d20_metamagic_db');
        localStorage.removeItem('d20_invocations_db');

        // Caricamento dai CSV
        parseFeaturesCSV(PRELOADED_CSV);
        parseFeatsCSV(PRELOADED_FEATS_CSV);
        parseFightingStylesCSV(PRELOADED_FIGHTING_STYLES_CSV);
        if (typeof PRELOADED_MANEUVERS_CSV !== 'undefined') parseManeuversCSV(PRELOADED_MANEUVERS_CSV);
        parseCunningStrikesCSV(PRELOADED_CUNNING_STRIKES_CSV);
        parseMetamagicCSV(PRELOADED_METAMAGIC_CSV);
        if (typeof PRELOADED_PSIONIC_POWERS_CSV !== 'undefined') parsePsionicPowersCSV(PRELOADED_PSIONIC_POWERS_CSV);
        if (typeof PRELOADED_PSIONIC_DISCIPLINES_CSV !== 'undefined') parsePsionicDisciplinesCSV(PRELOADED_PSIONIC_DISCIPLINES_CSV);
        if (typeof PRELOADED_ELD_INVOCATIONS_CSV !== 'undefined') parseInvocationsCSV(PRELOADED_ELD_INVOCATIONS_CSV);
        
        // Caricamento Proficiency
        Papa.parse(PRELOADED_PROFICIENCY_CSV, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                 const parsedProf = results.data.map(row => ({
                         name: row["Name"],
                         className: row["Class"],
                         cost: parseInt(row["Cost"]),
                         desc: row["Description"]
                 }));
                 setProficiencyDb(parsedProf);
            }
        });

        // Caricamento PROFILI UTENTE
        const savedProfiles = localStorage.getItem('d20_profiles');
        let loadedProfiles = savedProfiles ? JSON.parse(savedProfiles) : ['Personaggio 1'];
        setProfiles(loadedProfiles);
        
        const lastActive = localStorage.getItem('d20_active_profile');
        setCurrentProfile(lastActive && loadedProfiles.includes(lastActive) ? lastActive : loadedProfiles[0]);
    }, []);

    // --- LOAD DATA WHEN PROFILE CHANGES ---
    React.useEffect(() => {
        const dataStr = localStorage.getItem(`d20_profile_${currentProfile}`);
        if (dataStr) {
            try {
                const parsed = JSON.parse(dataStr);
                setCharData(migrateAndSanitizeCharacter(parsed));
            } catch (e) {
                console.error("Errore lettura dati profilo:", e);
                setCharData(migrateAndSanitizeCharacter({}));
            }
        } else {
            setCharData(migrateAndSanitizeCharacter({}));
        }
        localStorage.setItem('d20_active_profile', currentProfile);
    }, [currentProfile]);

    // --- SAVE DATA AUTOMATICALLY ---
    React.useEffect(() => {
        if (currentProfile && charData) {
            const cleanFeatures = deduplicateFeaturesList(charData.features || []).map(f => {
                if (typeof f === 'string') return f.trim();
                if (typeof f === 'object' && f && f.name) return f.name.trim();
                return null;
            }).filter(Boolean);

            const dataToSave = { 
                ...charData, 
                features: cleanFeatures,
                selectedFeatures: cleanFeatures,
                schemaVersion: CURRENT_SCHEMA_VERSION 
            };
            localStorage.setItem(`d20_profile_${currentProfile}`, JSON.stringify(dataToSave));
        }
    }, [charData, currentProfile]);

    // --- DATA UPDATE HANDLER ---
    const updateCharData = React.useCallback((field, value) => {
        setCharData(prev => ({ ...prev, [field]: value }));
    }, []);

    // --- CALCULATIONS ---
    const calculateFinalScore = (s) => {
        if (!s) return 10;
        return (s.base || 8) + (s.race || 0) + (s.feat || 0) + (s.ability || 0) + (s.misc || 0);
    };

    const calculateTotalBP = React.useCallback(() => 
        Object.values(charData.stats || DEFAULT_STATS).reduce((acc, s) => acc + (POINT_BUY_COSTS[s?.base] || 0), 0)
    , [charData.stats]);

    const totalAbilityScore = React.useMemo(() => 
        Object.values(charData.stats || DEFAULT_STATS).reduce((acc, s) => acc + (s?.ability || 0), 0)
    , [charData.stats]);
    
    const abilityCostCP = totalAbilityScore * 2;
    const totalCPAvailable = Math.ceil((charData.charPower?.level || 1) * (charData.charPower?.cpPerLevel || 12.5));
    
    const totalCPClasses = React.useMemo(() => deduplicateNamedList(charData.classes || []).reduce((acc, item) => {
        let cost = parseInt(item.level) || 0;
        if (item.showProficiency) {
            const prof = proficiencyMap[item.className];
            if (prof) cost += parseInt(prof.cost) || 0;
        }
        return acc + cost;
    }, 0), [charData.classes, proficiencyMap]);

    const totalCPFeats = React.useMemo(() => deduplicateNamedList(charData.feats || []).reduce((acc, f) => acc + (f.isBonus ? 0 : (parseInt(f.cost) || 0)), 0), [charData.feats]);

    const totalHpCost = React.useMemo(() => deduplicateNamedList(charData.classes || []).reduce((acc, cls) => {
        if (!cls.showProficiency) return acc;
        const base = getHpPerLevel(cls.className);
        const current = cls.selectedHp || base;
        return acc + calculateSingleHpCost(base, current);
    }, 0), [charData.classes, getHpPerLevel, calculateSingleHpCost]);
    
    const totalSkillCost = React.useMemo(() => {
        let count = 0;
        SKILLS_DATA.forEach(skill => {
            const s = charData.skills[skill.name];
            if (s && s.isProficient && !s.isClassSkill) count++;
        });
        return Math.max(0, count - 1);
    }, [charData.skills]);
    
    const totalCPFightingStyles = React.useMemo(() => deduplicateNamedList(charData.fightingStyles || []).length * 3, [charData.fightingStyles]);
    const totalCPMartialAdept = React.useMemo(() => {
        return deduplicateNamedList(charData.maneuvers || []).reduce((acc, item) => {
            if (typeof item === 'string') return acc + 3;
            return acc + (item.isFighter ? 0 : 3);
        }, 0);
    }, [charData.maneuvers]);
    const totalCPCunningStrikes = React.useMemo(() => deduplicateNamedList(charData.cunningStrikes || []).length * 2, [charData.cunningStrikes]);
    const hasPsionicPowerFeature = React.useMemo(() => {
        return deduplicateFeaturesList(charData.features || []).some(f => {
            const fObj = (typeof f === 'object') ? f : dbMap[f];
            return fObj && fObj.name && fObj.name.trim().toLowerCase() === 'psionic power';
        });
    }, [charData.features, dbMap]);

    const hasPsionicDisciplineFeature = React.useMemo(() => {
        return deduplicateFeaturesList(charData.features || []).some(f => {
            const fObj = (typeof f === 'object') ? f : dbMap[f];
            return fObj && fObj.name && fObj.name.trim().toLowerCase() === 'psionic discipline';
        });
    }, [charData.features, dbMap]);

    const totalCPPsionicPowers = React.useMemo(() => {
        if (!hasPsionicPowerFeature) return 0;
        return deduplicateNamedList(charData.psionicPowers || []).reduce((acc, p) => {
            const cost = (typeof p === 'object' && p.cost !== undefined) ? parseInt(p.cost) : 2;
            return acc + (isNaN(cost) ? 2 : cost);
        }, 0);
    }, [charData.psionicPowers, hasPsionicPowerFeature]);

    const totalCPPsionicDisciplines = React.useMemo(() => {
        if (!hasPsionicDisciplineFeature) return 0;
        return deduplicateNamedList(charData.psionicDisciplines || []).reduce((acc, p) => {
            const cost = (typeof p === 'object' && p.cost !== undefined) ? parseInt(p.cost) : 2;
            return acc + (isNaN(cost) ? 2 : cost);
        }, 0);
    }, [charData.psionicDisciplines, hasPsionicDisciplineFeature]);

    const totalCPMetamagic = React.useMemo(() => {
        return deduplicateNamedList(charData.metamagic || []).reduce((acc, item) => {
            if (typeof item === 'string') return acc + 2;
            return acc + (item.isSorcerer ? 0 : 2);
        }, 0);
    }, [charData.metamagic]);

    const totalCPEldritchAdept = React.useMemo(() => {
        return deduplicateNamedList(charData.invocations || []).reduce((acc, item) => {
            if (typeof item === 'string') return acc + 3;
            return acc + (item.isWarlock ? 0 : 3);
        }, 0);
    }, [charData.invocations]);
    
    const totalCPMagic = React.useMemo(() => {
        const m = charData.magic || { extraSpells: 0, extraSlots: 0, slotAsMana: false };
        let base = (m.extraSpells || 0) * 1 + (m.extraSlots || 0) * 10 + (m.slotAsMana ? 10 : 0);
        
        const spellcastingCost = deduplicateStringList(charData.spellcasting || []).reduce((acc, scName) => {
             const sc = SPELLCASTING_DATA.find(s => s.name === scName);
             return acc + (sc ? sc.cost : 0);
        }, 0);
        
        const slotTypes = ['full', 'full', 'half', 'half', 'third', 'third'];
        const casterLevelCost = (m.casterSlots || []).reduce((acc, slot, idx) => {
            if (!slot || !slot.active) return acc;
            const type = slotTypes[idx];
            let level = slot.level;
            if (type === 'half') level = Math.ceil(level / 2);
            else if (type === 'third') level = Math.floor(level / 3);
            return acc + level;
        }, 0);
        
        return base + spellcastingCost + casterLevelCost;
    }, [charData.magic, charData.spellcasting]);

    // --- FILTERING & PREREQUISITES HELPERS ---
    const selectedFeatureNames = React.useMemo(() => new Set((charData.features || []).map(f => {
        const featObj = (typeof f === 'object') ? f : (dbMap[f] || (typeof f === 'string' ? dbMap[f.trim().toLowerCase()] : null));
        return featObj ? featObj.name.trim().toLowerCase() : null;
    }).filter(Boolean)), [dbMap, charData.features]);

    const checkSinglePrereqString = (prereqString, featureNamesSet, magicData, spellcastingList = []) => {
        const raw = prereqString.trim().toLowerCase();
        if (!raw || raw === '-') return true;

        if (featureNamesSet.has(raw)) return true;
        if (raw === 'spellcasting' || raw === 'spell casting') {
            const hasSlots = (magicData?.casterSlots || []).some(s => s && s.level > 0);
            const hasScClass = (spellcastingList || []).length > 0;
            return hasSlots || hasScClass || featureNamesSet.has('spellcasting') || featureNamesSet.has('spell casting');
        }

        if (raw.includes(',')) {
            const subParts = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            return subParts.every(sub => {
                if (sub === 'spellcasting' || sub === 'spell casting') {
                    const hasSlots = (magicData?.casterSlots || []).some(s => s && s.level > 0);
                    const hasScClass = (spellcastingList || []).length > 0;
                    return hasSlots || hasScClass || featureNamesSet.has('spellcasting') || featureNamesSet.has('spell casting');
                }
                return featureNamesSet.has(sub);
            });
        }

        return false;
    };

    const isFeatureEligible = React.useCallback((feature, activeFeaturesList, classesList, magicData, spellcastingList = []) => {
        const f = (typeof feature === 'object') ? feature : (dbMap[feature] || (typeof feature === 'string' ? (dbMap[feature.trim().toLowerCase()] || dbMap[normalizeFeatureName(feature)]) : null));
        if (!f) return false;

        // 1. Requisito di classe e livello
        if (!isFeatureClassAllowed(f, classesList)) {
            return false;
        }

        // 2. Requisiti di abilità propedeutiche (f.pre)
        if (f.pre && f.pre !== '-') {
            const featObj = f;
            const otherFeatures = (activeFeaturesList || []).filter(item => {
                const itemObj = (typeof item === 'object') ? item : (dbMap[item] || (typeof item === 'string' ? (dbMap[item.trim().toLowerCase()] || dbMap[normalizeFeatureName(item)]) : null));
                const otherName = itemObj ? itemObj.name : (typeof item === 'string' ? item : null);
                return otherName && otherName.trim().toLowerCase() !== featObj.name.trim().toLowerCase();
            });

            const featureNames = new Set(
                otherFeatures.map(item => {
                    const itemObj = (typeof item === 'object') ? item : (dbMap[item] || (typeof item === 'string' ? (dbMap[item.trim().toLowerCase()] || dbMap[normalizeFeatureName(item)]) : null));
                    return itemObj && itemObj.name ? itemObj.name.trim().toLowerCase() : (typeof item === 'string' ? item.trim().toLowerCase() : null);
                }).filter(Boolean)
            );

            otherFeatures.forEach(item => {
                const itemObj = (typeof item === 'object') ? item : (dbMap[item] || (typeof item === 'string' ? (dbMap[item.trim().toLowerCase()] || dbMap[normalizeFeatureName(item)]) : null));
                const n = itemObj && itemObj.name ? itemObj.name : (typeof item === 'string' ? item : null);
                if (n) {
                    featureNames.add(normalizeFeatureName(n));
                }
            });

            const parts = f.pre.split(';').map(p => p.trim()).filter(Boolean);
            const allPrereqsMet = parts.every(part => checkSinglePrereqString(part, featureNames, magicData, spellcastingList));
            if (!allPrereqsMet) return false;
        }

        return true;
    }, [dbMap]);

    const checkPrereq = React.useCallback((str) => {
        if (!str || str === '-') return true;
        return checkSinglePrereqString(str, selectedFeatureNames, charData.magic, charData.spellcasting);
    }, [selectedFeatureNames, charData.magic, charData.spellcasting]);

    const checkClassPrereq = React.useCallback((feature) => {
        return checkFeatureClassRequirement(feature, charData.classes);
    }, [charData.classes]);

    const totalCPSpent = React.useMemo(() => {
        const uniqueFeatures = deduplicateFeaturesList(charData.features || []);
        const featuresCost = uniqueFeatures.reduce((acc, feat) => {
            const f = (typeof feat === 'object') ? feat : (dbMap[feat] || (typeof feat === 'string' ? (dbMap[feat.trim().toLowerCase()] || dbMap[normalizeFeatureName(feat)]) : null));
            if (!f) return acc;
            if (!isFeatureEligible(f, uniqueFeatures, charData.classes, charData.magic, charData.spellcasting)) {
                return acc;
            }
            return acc + (parseInt(f.cp) || 0);
        }, 0);
        return featuresCost + totalCPClasses + totalCPFeats + abilityCostCP + totalHpCost + totalSkillCost + totalCPFightingStyles + totalCPMartialAdept + totalCPCunningStrikes + totalCPMetamagic + totalCPEldritchAdept + totalCPPsionicPowers + totalCPPsionicDisciplines + totalCPMagic;
    }, [charData.features, dbMap, isFeatureEligible, charData.classes, charData.magic, charData.spellcasting, totalCPClasses, totalCPFeats, abilityCostCP, totalHpCost, totalSkillCost, totalCPFightingStyles, totalCPMartialAdept, totalCPCunningStrikes, totalCPMetamagic, totalCPEldritchAdept, totalCPPsionicPowers, totalCPPsionicDisciplines, totalCPMagic]);

    // HP Calc
    const conMod = getAbilityMod(calculateFinalScore(charData.stats?.CON));
    const hpClass = (charData.classes || []).find(c => c.showProficiency);
    const currentHpPerLevel = hpClass ? (hpClass.selectedHp || getHpPerLevel(hpClass.className)) : 0;
    const totalHP = (currentHpPerLevel + conMod) * (charData.charPower?.level || 1);
    const bpUsed = calculateTotalBP();

    // --- AUTO-VALIDATION & MIGRATION ---
    React.useEffect(() => {
        if (db.length === 0) return;

        const migrateList = (list, sourceMap, isMetamagic = false, isManeuver = false, isInvocation = false) => {
            return (list || []).map(item => {
                if (typeof item === 'object' && item !== null && item.name) {
                    const normName = normalizeFeatureName(item.name);
                    let found = null;
                    if (Array.isArray(sourceMap)) {
                        found = sourceMap.find(x => normalizeFeatureName(x.name) === normName || String(x.id).trim() === String(item.id).trim());
                    } else if (sourceMap && typeof sourceMap === 'object') {
                        found = sourceMap[item.id] || sourceMap[item.name.trim().toLowerCase()] || Object.values(sourceMap).find(x => normalizeFeatureName(x.name) === normName);
                    }
                    if (found) {
                        return { ...found, ...item, id: found.id, name: found.name };
                    }
                    return item;
                }
                const id = typeof item === 'object' ? item.id : item;
                let found = null;
                if (Array.isArray(sourceMap)) {
                    const idStr = String(id).trim().toLowerCase();
                    const normId = normalizeFeatureName(id);
                    found = sourceMap.find(x => String(x.id).trim().toLowerCase() === idStr || normalizeFeatureName(x.name) === normId);
                } else if (sourceMap && typeof sourceMap === 'object') {
                    const cleanId = typeof id === 'string' ? id.trim().toLowerCase() : id;
                    const normId = typeof id === 'string' ? normalizeFeatureName(id) : '';
                    found = sourceMap[id] || sourceMap[cleanId] || (normId ? Object.values(sourceMap).find(x => normalizeFeatureName(x.name) === normId) : null);
                }
                if (!found) return null;
                if (isMetamagic) {
                    const isSorc = (typeof item === 'object' && item.isSorcerer) || false;
                    return { ...found, isSorcerer: isSorc };
                }
                if (isManeuver) {
                    const isFighter = (typeof item === 'object' && item.isFighter) || false;
                    return { ...found, isFighter: isFighter };
                }
                if (isInvocation) {
                    const isWarlock = (typeof item === 'object' && item.isWarlock) || false;
                    return { ...found, isWarlock: isWarlock };
                }
                return found;
            }).filter(Boolean);
        };

        let newData = { ...charData };
        let hasChanges = false;

        if ((charData.features || []).some(f => typeof f === 'object' || typeof f === 'number')) {
            const cleanList = deduplicateFeaturesList(charData.features.map(f => {
                if (typeof f === 'string') return f.trim();
                if (typeof f === 'object' && f && f.name) return f.name.trim();
                return null;
            }).filter(Boolean));
            newData.features = cleanList;
            newData.selectedFeatures = cleanList;
            hasChanges = true;
        } else {
            const dedupFeatures = deduplicateFeaturesList(charData.features || []);
            if (dedupFeatures.length !== (charData.features || []).length) {
                newData.features = dedupFeatures;
                newData.selectedFeatures = dedupFeatures;
                hasChanges = true;
            }
        }

        if ((charData.fightingStyles || []).some(s => typeof s === 'string')) {
            newData.fightingStyles = deduplicateNamedList(migrateList(charData.fightingStyles, fightingStylesDb));
            hasChanges = true;
        } else {
            const dedupStyles = deduplicateNamedList(charData.fightingStyles || []);
            if (dedupStyles.length !== (charData.fightingStyles || []).length) {
                newData.fightingStyles = dedupStyles;
                hasChanges = true;
            }
        }

        if ((charData.maneuvers || []).some(m => typeof m === 'string' || (typeof m === 'object' && !m.name))) {
            newData.maneuvers = deduplicateNamedList(migrateList(charData.maneuvers, maneuversDb, false, true));
            hasChanges = true;
        } else {
            const dedupManeuvers = deduplicateNamedList(charData.maneuvers || []);
            if (dedupManeuvers.length !== (charData.maneuvers || []).length) {
                newData.maneuvers = dedupManeuvers;
                hasChanges = true;
            }
        }

        if ((charData.cunningStrikes || []).some(c => typeof c === 'string')) {
            newData.cunningStrikes = deduplicateNamedList(migrateList(charData.cunningStrikes, cunningStrikesDb));
            hasChanges = true;
        } else {
            const dedupStrikes = deduplicateNamedList(charData.cunningStrikes || []);
            if (dedupStrikes.length !== (charData.cunningStrikes || []).length) {
                newData.cunningStrikes = dedupStrikes;
                hasChanges = true;
            }
        }

        if ((charData.metamagic || []).some(m => typeof m === 'string' || (typeof m === 'object' && !m.name))) {
            newData.metamagic = deduplicateNamedList(migrateList(charData.metamagic, metamagicDb, true));
            hasChanges = true;
        } else {
            const dedupMetamagic = deduplicateNamedList(charData.metamagic || []);
            if (dedupMetamagic.length !== (charData.metamagic || []).length) {
                newData.metamagic = dedupMetamagic;
                hasChanges = true;
            }
        }

        if ((charData.invocations || []).some(inv => typeof inv === 'string' || (typeof inv === 'object' && !inv.name))) {
            newData.invocations = deduplicateNamedList(migrateList(charData.invocations, invocationsMap, false, false, true));
            hasChanges = true;
        } else {
            const dedupInvocations = deduplicateNamedList(charData.invocations || []);
            if (dedupInvocations.length !== (charData.invocations || []).length) {
                newData.invocations = dedupInvocations;
                hasChanges = true;
            }
        }

        const dedupFeats = deduplicateNamedList(charData.feats || []);
        if (dedupFeats.length !== (charData.feats || []).length) {
            newData.feats = dedupFeats;
            hasChanges = true;
        }

        const dedupClasses = deduplicateNamedList(charData.classes || []);
        if (dedupClasses.length !== (charData.classes || []).length) {
            newData.classes = dedupClasses;
            hasChanges = true;
        }

        const dedupPsiPowers = deduplicateNamedList(charData.psionicPowers || []);
        if (dedupPsiPowers.length !== (charData.psionicPowers || []).length) {
            newData.psionicPowers = dedupPsiPowers;
            hasChanges = true;
        }

        const dedupPsiDisciplines = deduplicateNamedList(charData.psionicDisciplines || []);
        if (dedupPsiDisciplines.length !== (charData.psionicDisciplines || []).length) {
            newData.psionicDisciplines = dedupPsiDisciplines;
            hasChanges = true;
        }

        const dedupSpellcasting = deduplicateStringList(charData.spellcasting || []);
        if (dedupSpellcasting.length !== (charData.spellcasting || []).length) {
            newData.spellcasting = dedupSpellcasting;
            hasChanges = true;
        }

        if (hasChanges) {
            console.log("Migrazione e deduplicazione dati completata.");
            setCharData(newData);
        }
    }, [charData.features, charData.fightingStyles, charData.maneuvers, charData.cunningStrikes, charData.metamagic, charData.invocations, charData.feats, charData.classes, charData.psionicPowers, charData.psionicDisciplines, charData.spellcasting, dbMap, fightingStylesDb, maneuversDb, cunningStrikesDb, metamagicDb, invocationsMap, db.length]); 

    // --- CASCADE AUTO-PRUNE INVALID CLASS FEATURES ---
    React.useEffect(() => {
        if (!db || db.length === 0 || !charData.features || charData.features.length === 0) return;

        let currentList = deduplicateFeaturesList(charData.features);
        let prunedAny = false;
        const initialCount = currentList.length;

        // Loop a cascata per risolvere dipendenze ad albero finché tutte le feature residue sono al 100% idonee
        while (true) {
            let changedInPass = false;
            const nextList = [];

            for (const feat of currentList) {
                if (isFeatureEligible(feat, currentList, charData.classes, charData.magic, charData.spellcasting)) {
                    nextList.push(feat);
                } else {
                    changedInPass = true;
                    prunedAny = true;
                }
            }

            currentList = nextList;
            if (!changedInPass) break;
        }

        if (prunedAny) {
            const hasPsiPower = currentList.some(f => {
                const fObj = (typeof f === 'object') ? f : dbMap[f];
                const fn = fObj ? fObj.name : String(f);
                return fn && fn.trim().toLowerCase() === 'psionic power';
            });
            const hasPsiDisc = currentList.some(f => {
                const fObj = (typeof f === 'object') ? f : dbMap[f];
                const fn = fObj ? fObj.name : String(f);
                return fn && fn.trim().toLowerCase() === 'psionic discipline';
            });

            setCharData(prev => ({
                ...prev,
                features: currentList,
                selectedFeatures: currentList,
                psionicPowers: hasPsiPower ? (prev.psionicPowers || []) : [],
                psionicDisciplines: hasPsiDisc ? (prev.psionicDisciplines || []) : []
            }));

            const removedCount = initialCount - currentList.length;
            showToast(`${removedCount} ${removedCount === 1 ? 'abilità rimossa' : 'abilità rimosse'} per prerequisiti non più soddisfatti`, "info");
        }
    }, [charData.features, charData.classes, charData.magic, charData.spellcasting, isFeatureEligible, db.length, dbMap, showToast]);

    const toggleFeature = (id) => {
        const f = dbMap[id] || (typeof id === 'object' ? id : (typeof id === 'string' ? (dbMap[id.toLowerCase()] || dbMap[normalizeFeatureName(id)]) : null));
        const featTarget = f || id;
        const exists = isFeatureSelected(featTarget, charData.features, dbMap);

        if (exists) {
            const fObj = f || (typeof featTarget === 'object' ? featTarget : (dbMap[featTarget] || null));
            const featName = (fObj && fObj.name) ? fObj.name.trim().toLowerCase() : (typeof featTarget === 'string' ? featTarget.trim().toLowerCase() : '');
            
            let extraUpdates = {};
            if (featName === 'psionic power') {
                extraUpdates.psionicPowers = [];
                setPsionicPowerSelection('');
            } else if (featName === 'psionic discipline') {
                extraUpdates.psionicDisciplines = [];
                setPsionicDisciplineSelection('');
            }
            
            const updatedList = (charData.features || []).filter(item => !isFeatureSelected(featTarget, [item], dbMap));
            setCharData(prev => ({
                ...prev,
                features: updatedList,
                selectedFeatures: updatedList,
                ...extraUpdates
            }));
            showToast("Abilità rimossa");
            return;
        }
        if (f) {
            if (!isFeatureEligible(f, charData.features, charData.classes, charData.magic, charData.spellcasting)) {
                const classCheck = checkClassPrereq(f);
                if (!classCheck.allowed) {
                    showToast(classCheck.msg || "Prerequisiti di classe non soddisfatti", "error");
                } else {
                    showToast("Prerequisiti di abilità propedeutiche non soddisfatti", "error");
                }
                return;
            }
            const featName = f.name ? f.name.trim() : String(f).trim();
            const updatedList = deduplicateFeaturesList([...(charData.features || []), featName]);
            setCharData(prev => ({
                ...prev,
                features: updatedList,
                selectedFeatures: updatedList
            }));
            showToast("Abilità aggiunta!");
        }
    };

    const visibleFeatures = React.useMemo(() => {
        if (!db || !Array.isArray(db)) return [];
        return db.filter(feature => {
            // Controllo filtro classe
            if (selectedClassFilter && selectedClassFilter !== "all") {
                const featureClasses = (feature.tag || feature.class || "").toLowerCase();
                const filterLower = selectedClassFilter.toLowerCase();
                let matchesClass = featureClasses.includes(filterLower);
                if (!matchesClass) {
                    if (filterLower === 'artificer' && featureClasses.includes('artificier')) matchesClass = true;
                    if (filterLower === 'artificier' && featureClasses.includes('artificer')) matchesClass = true;
                }
                if (!matchesClass) return false;
            }

            // Controllo ricerca testuale (se presente)
            if (search && search.trim() !== "") {
                const term = search.trim().toLowerCase();
                const matchName = (feature.name || "").toLowerCase().includes(term);
                const matchDesc = (feature.desc || feature.description || "").toLowerCase().includes(term);
                const matchPre = (feature.pre || "").toLowerCase().includes(term);
                if (!matchName && !matchDesc && !matchPre) return false;
            }

            // Controllo solo selezionati
            if (showSelectedOnly) {
                const isSelected = isFeatureSelected(feature, charData.features, dbMap);
                if (!isSelected) return false;
            }

            return true;
        });
    }, [db, selectedClassFilter, search, showSelectedOnly, charData.features, dbMap]);

    const filteredData = visibleFeatures;

    const toggleTag = (tag) => setSelectedClassFilter(current => (current && current.toLowerCase() === tag.toLowerCase()) ? "all" : tag);

    const availableFeats = React.useMemo(() => featsDb.filter(f => !charData.feats.some(sf => sf.id === f.id)).sort((a,b) => a.name.localeCompare(b.name)), [featsDb, charData.feats]);
    const availableFightingStyles = React.useMemo(() => fightingStylesDb.filter(s => !charData.fightingStyles.some(fs => fs.id === s.id)).sort((a,b) => a.name.localeCompare(b.name)), [fightingStylesDb, charData.fightingStyles]);
    const availableCunningStrikes = React.useMemo(() => cunningStrikesDb.filter(s => !charData.cunningStrikes.some(cs => cs.id === s.id)).sort((a,b) => a.name.localeCompare(b.name)), [cunningStrikesDb, charData.cunningStrikes]);
    // --- AUTO-CLEANUP ORPHANED PSIONIC POWERS & DISCIPLINES ---
    React.useEffect(() => {
        let needsUpdate = false;
        let nextPowers = charData.psionicPowers || [];
        let nextDisciplines = charData.psionicDisciplines || [];

        if (!hasPsionicPowerFeature && nextPowers.length > 0) {
            nextPowers = [];
            needsUpdate = true;
        }

        if (!hasPsionicDisciplineFeature && nextDisciplines.length > 0) {
            nextDisciplines = [];
            needsUpdate = true;
        }

        if (needsUpdate) {
            setCharData(prev => ({
                ...prev,
                psionicPowers: nextPowers,
                psionicDisciplines: nextDisciplines
            }));
        }
    }, [hasPsionicPowerFeature, hasPsionicDisciplineFeature, charData.psionicPowers, charData.psionicDisciplines]);

    const availablePsionicPowers = React.useMemo(() => {
        return psionicPowersDb.filter(s => !(charData.psionicPowers || []).some(p => (typeof p === 'object' ? p.id : p) === s.id)).sort((a,b) => a.name.localeCompare(b.name));
    }, [psionicPowersDb, charData.psionicPowers]);

    const addPsionicPower = () => {
        if (!psionicPowerSelection) return;
        if (!hasPsionicPowerFeature) {
            setAlertModal({
                title: "Privilegio Mancante",
                message: "Per selezionare i poteri psionici devi prima acquisire il privilegio 'Psionic Power' in Class Features."
            });
            return;
        }
        const powerObj = psionicPowersDb.find(s => s.id === psionicPowerSelection);
        if (powerObj) {
            const current = charData.psionicPowers || [];
            const alreadyIn = current.some(p => (typeof p === 'object' ? p.id : p) === powerObj.id || (p.name && p.name.toLowerCase() === powerObj.name.toLowerCase()));
            if (!alreadyIn) {
                updateCharData('psionicPowers', deduplicateNamedList([...current, powerObj]));
                setPsionicPowerSelection('');
                showToast(`Potere Psionico aggiunto: ${powerObj.name}`);
            } else {
                showToast("Potere già presente", "info");
            }
        }
    };

    const removePsionicPower = (powerId) => {
        const targetIdStr = String(powerId).trim();
        updateCharData('psionicPowers', (charData.psionicPowers || []).filter(s => {
            const sId = typeof s === 'object' ? String(s.id).trim() : String(s).trim();
            return sId !== targetIdStr;
        }));
        showToast("Potere Psionico rimosso", "info");
    };

    const availablePsionicDisciplines = React.useMemo(() => {
        return psionicDisciplinesDb.filter(s => !(charData.psionicDisciplines || []).some(p => (typeof p === 'object' ? p.id : p) === s.id)).sort((a,b) => a.name.localeCompare(b.name));
    }, [psionicDisciplinesDb, charData.psionicDisciplines]);

    const addPsionicDiscipline = () => {
        if (!psionicDisciplineSelection) return;
        if (!hasPsionicDisciplineFeature) {
            setAlertModal({
                title: "Privilegio Mancante",
                message: "Per selezionare le discipline psioniche devi prima acquisire il privilegio 'Psionic Discipline' in Class Features."
            });
            return;
        }
        const discObj = psionicDisciplinesDb.find(s => s.id === psionicDisciplineSelection);
        if (discObj) {
            const current = charData.psionicDisciplines || [];
            const alreadyIn = current.some(p => (typeof p === 'object' ? p.id : p) === discObj.id || (p.name && p.name.toLowerCase() === discObj.name.toLowerCase()));
            if (!alreadyIn) {
                updateCharData('psionicDisciplines', deduplicateNamedList([...current, discObj]));
                setPsionicDisciplineSelection('');
                showToast(`Disciplina Psionica aggiunta: ${discObj.name}`);
            } else {
                showToast("Disciplina già presente", "info");
            }
        }
    };

    const removePsionicDiscipline = (discId) => {
        const targetIdStr = String(discId).trim();
        updateCharData('psionicDisciplines', (charData.psionicDisciplines || []).filter(s => {
            const sId = typeof s === 'object' ? String(s.id).trim() : String(s).trim();
            return sId !== targetIdStr;
        }));
        showToast("Disciplina Psionica rimossa", "info");
    };

    const availableManeuvers = React.useMemo(() => (maneuversDb || []).filter(s => {
        return !(charData.maneuvers || []).some(m => (typeof m === 'string' ? m : m.id) === s.id);
    }).sort((a,b) => a.name.localeCompare(b.name)), [maneuversDb, charData.maneuvers]);

    const availableMetamagic = React.useMemo(() => metamagicDb.filter(s => {
        return !charData.metamagic.some(m => (typeof m === 'string' ? m : m.id) === s.id);
    }).sort((a,b) => a.name.localeCompare(b.name)), [metamagicDb, charData.metamagic]);

    const availableInvocations = React.useMemo(() => (invocationsDb || []).filter(s => {
        return !(charData.invocations || []).some(m => (typeof m === 'string' ? m : m.id) === s.id);
    }).sort((a,b) => a.name.localeCompare(b.name)), [invocationsDb, charData.invocations]);

    const hpClassesForDisplay = React.useMemo(() => charData.classes.filter(c => c.showProficiency), [charData.classes]);

    // --- AUTO-VALIDAZIONE SPELLCASTING ---
    React.useEffect(() => {
        const currentSc = charData.spellcasting || [];
        if (currentSc.length === 0) return;

        const validSc = currentSc.filter(scName => {
            let reqClass = (scName.split(', ')[1] || scName).trim(); 
            if (reqClass === 'Eldritch Knight') {
                return charData.classes.some(c => c.className === 'Fighter' && (parseInt(c.level) || 0) >= 3);
            }
            if (reqClass === 'Arcane Trickster') {
                return charData.classes.some(c => c.className === 'Rogue' && (parseInt(c.level) || 0) >= 3);
            }
            if (reqClass.includes('Monk') || reqClass.includes('Warrior of the Mystic Arts')) {
                const hasMonkLevel = charData.classes.some(c => c.className === 'Monk' && (parseInt(c.level) || 0) >= 3);
                const hasMonkFeature = (charData.features || []).some(f => {
                    const fn = (typeof f === 'string' ? f : (f.name || '')).toLowerCase();
                    return fn.includes('warrior of the mystic arts');
                });
                return hasMonkLevel || hasMonkFeature;
            }
            return charData.classes.some(c => c.className === reqClass && (parseInt(c.level) || 0) > 0);
        });

        if (validSc.length !== currentSc.length) {
            updateCharData('spellcasting', validSc);
        }
    }, [charData.classes, charData.features, charData.spellcasting, updateCharData]);
    
    // --- UI HANDLERS ---
    const handleStatChange = React.useCallback((stat, field, value) => {
        setCharData(prev => ({
            ...prev,
            stats: {
                ...prev.stats,
                [stat]: { ...prev.stats[stat], [field]: parseInt(value) || 0 }
            }
        }));
    }, []);
    
    const handleCharPowerChange = React.useCallback((field, value) => {
        setCharData(prev => ({
            ...prev,
            charPower: { ...prev.charPower, [field]: value }
        }));
    }, []);
    
    const handleMagicChange = React.useCallback((field, value) => {
        setCharData(prev => ({
            ...prev,
            magic: { ...prev.magic, [field]: value }
        }));
    }, []);
    
    const CASTER_SLOTS_CONFIG = [
        { label: "Spell caster level, full caster 1", type: "full" },
        { label: "Spell caster level, full caster 2", type: "full" },
        { label: "Spell caster level, half caster 1", type: "half" },
        { label: "Spell caster level, half caster 2", type: "half" },
        { label: "Spell caster level, 1/3 caster 1", type: "third" },
        { label: "Spell caster level, 1/3 caster 2", type: "third" }
    ];

    const handleCasterSlotChange = (index, field, value) => {
        const currentMagic = charData.magic || {};
        const currentSlots = currentMagic.casterSlots || [];
        const newSlots = CASTER_SLOTS_CONFIG.map((cfg, i) => {
            return currentSlots[i] || { active: false, level: 1 };
        });

        if (field === 'active') newSlots[index].active = !newSlots[index].active;
        else newSlots[index][field] = parseInt(value) || 1;

        updateCharData('magic', { ...currentMagic, casterSlots: newSlots });
    };

    const calculateCasterLevel = (type, level) => {
        if (type === 'full') return level;
        if (type === 'half') return Math.ceil(level / 2); 
        if (type === 'third') return Math.floor(level / 3); 
        return 0;
    };

    const addClass = () => updateCharData('classes', [...(charData.classes || []), { className: '', level: 1, showProficiency: false, selectedHp: 0 }]);
    const removeClass = (index) => updateCharData('classes', (charData.classes || []).filter((_, i) => i !== index));

    const updateClass = (index, field, value) => {
        if (field === 'level' && parseInt(value) > (charData.charPower?.level || 1)) {
            setAlertModal({
                title: "Livello Classe Non Valido",
                message: `Il livello della classe (${value}) non può superare il livello totale del personaggio (${charData.charPower?.level || 1}).`
            });
            return;
        }
        const newClasses = [...(charData.classes || [])];
        const updatedClass = { ...newClasses[index] };
        if (field === 'className') {
             const baseHp = getHpPerLevel(value);
             updatedClass.selectedHp = baseHp;
             updatedClass.className = value;
        } else {
             updatedClass[field] = value;
        }
        newClasses[index] = updatedClass;
        updateCharData('classes', newClasses);
    };

    const toggleClassProficiency = (index) => {
        const newClasses = (charData.classes || []).map((cls, idx) => {
            if (idx === index) return { ...cls, showProficiency: !cls.showProficiency };
            if (!charData.classes[index].showProficiency) return { ...cls, showProficiency: false };
            return cls;
        });
        updateCharData('classes', newClasses);
    };

    const updateClassHp = (classIndex, value) => {
        const newClasses = [...(charData.classes || [])];
        newClasses[classIndex] = { ...newClasses[classIndex], selectedHp: parseInt(value) || 0 };
        updateCharData('classes', newClasses);
    };

    const addFeat = () => {
        if (!featSelection) return;
        const featToAdd = featsMap[featSelection];
        if (featToAdd) {
            const current = charData.feats || [];
            const alreadyIn = current.some(f => (typeof f === 'object' ? f.id : f) === featToAdd.id || (f.name && f.name.toLowerCase() === featToAdd.name.toLowerCase()));
            if (!alreadyIn) {
                updateCharData('feats', deduplicateNamedList([...current, { ...featToAdd, isBonus: false }]));
                setFeatSelection("");
                showToast("Talento aggiunto!");
            }
        }
    };
    const removeFeat = (index) => {
        updateCharData('feats', (charData.feats || []).filter((_, i) => i !== index));
        showToast("Talento rimosso");
    };
    const toggleBonusFeat = (index) => {
        const newFeats = [...(charData.feats || [])];
        newFeats[index].isBonus = !newFeats[index].isBonus;
        updateCharData('feats', newFeats);
    };

    const addFightingStyle = () => {
        if (!fightingStyleSelection) return;
        const styleObj = fightingStylesDb.find(s => s.id === fightingStyleSelection); 
        if (styleObj) {
            const current = charData.fightingStyles || [];
            const alreadyIn = current.some(s => (typeof s === 'object' ? s.id : s) === styleObj.id || (s.name && s.name.toLowerCase() === styleObj.name.toLowerCase()));
            if (!alreadyIn) {
                updateCharData('fightingStyles', deduplicateNamedList([...current, styleObj]));
                setFightingStyleSelection("");
                showToast("Stile di combattimento aggiunto!");
            }
        }
    };

    const removeFightingStyle = (styleId) => {
        const targetIdStr = String(styleId).trim();
        updateCharData('fightingStyles', (charData.fightingStyles || []).filter(s => {
            const sId = typeof s === 'object' ? String(s.id).trim() : String(s).trim();
            return sId !== targetIdStr;
        }));
        showToast("Stile rimosso");
    };

    const addCunningStrike = () => {
        if (!cunningStrikeSelection) return;
        const strikeObj = cunningStrikesDb.find(s => s.id === cunningStrikeSelection); 
        if (strikeObj) {
            const current = charData.cunningStrikes || [];
            const alreadyIn = current.some(s => (typeof s === 'object' ? s.id : s) === strikeObj.id || (s.name && s.name.toLowerCase() === strikeObj.name.toLowerCase()));
            if (!alreadyIn) {
                updateCharData('cunningStrikes', deduplicateNamedList([...current, strikeObj]));
                setCunningStrikeSelection("");
                showToast("Cunning Strike aggiunto!");
            }
        }
    };

    const removeCunningStrike = (styleId) => {
        const targetIdStr = String(styleId).trim();
        updateCharData('cunningStrikes', (charData.cunningStrikes || []).filter(s => {
            const sId = typeof s === 'object' ? String(s.id).trim() : String(s).trim();
            return sId !== targetIdStr;
        }));
        showToast("Strike rimosso");
    };

    const addManeuver = () => {
        if (!maneuverSelection) return;
        const mObj = maneuversDb.find(m => m.id === maneuverSelection); 
        if (mObj) {
            const current = charData.maneuvers || [];
            const alreadyIn = current.some(m => (typeof m === 'object' ? m.id : m) === mObj.id || (m.name && m.name.toLowerCase() === mObj.name.toLowerCase()));
            if (!alreadyIn) {
                updateCharData('maneuvers', deduplicateNamedList([...current, { ...mObj, isFighter: false }]));
                setManeuverSelection("");
                showToast("Manovra aggiunta!");
            }
        }
    };

    const removeManeuver = (mId) => {
        const targetIdStr = String(mId).trim();
        updateCharData('maneuvers', (charData.maneuvers || []).filter(item => {
            const currentId = typeof item === 'object' ? String(item.id).trim() : String(item).trim();
            return currentId !== targetIdStr;
        }));
        showToast("Manovra rimossa");
    };

    const toggleFighterManeuver = (mId) => {
        const newManeuvers = (charData.maneuvers || []).map(item => {
            const currentItem = typeof item === 'string' ? { id: item, isFighter: false } : { ...item };
            if (currentItem.id === mId) {
                currentItem.isFighter = !currentItem.isFighter;
            }
            return currentItem;
        });
        updateCharData('maneuvers', newManeuvers);
    };

    const addMetamagic = () => {
        if (!metamagicSelection) return;
        const mmObj = metamagicDb.find(m => m.id === metamagicSelection); 
        if (mmObj) {
            const current = charData.metamagic || [];
            const alreadyIn = current.some(m => (typeof m === 'object' ? m.id : m) === mmObj.id || (m.name && m.name.toLowerCase() === mmObj.name.toLowerCase()));
            if (!alreadyIn) {
                updateCharData('metamagic', deduplicateNamedList([...current, { ...mmObj, isSorcerer: false }]));
                setMetamagicSelection("");
                showToast("Metamagic aggiunta!");
            }
        }
    };

    const removeMetamagic = (styleId) => {
        const targetIdStr = String(styleId).trim();
        updateCharData('metamagic', (charData.metamagic || []).filter(item => {
            const currentId = typeof item === 'object' ? String(item.id).trim() : String(item).trim();
            return currentId !== targetIdStr;
        }));
        showToast("Metamagic rimossa");
    };

    const toggleSorcererMetamagic = (styleId) => {
        const newMeta = (charData.metamagic || []).map(item => {
            const currentItem = typeof item === 'string' ? { id: item, isSorcerer: false } : { ...item };
            if (currentItem.id === styleId) {
                currentItem.isSorcerer = !currentItem.isSorcerer;
            }
            return currentItem;
        });
        updateCharData('metamagic', newMeta);
    };

    const addInvocation = () => {
        if (!invocationSelection) return;
        const invObj = invocationsDb.find(m => m.id === invocationSelection); 
        if (invObj) {
            const current = charData.invocations || [];
            const alreadyIn = current.some(m => (typeof m === 'object' ? m.id : m) === invObj.id || (m.name && m.name.toLowerCase() === invObj.name.toLowerCase()));
            if (!alreadyIn) {
                updateCharData('invocations', deduplicateNamedList([...current, { ...invObj, isWarlock: false }]));
                setInvocationSelection("");
                showToast("Invocazione aggiunta!");
            }
        }
    };

    const removeInvocation = (invId) => {
        const targetIdStr = String(invId).trim();
        updateCharData('invocations', (charData.invocations || []).filter(item => {
            const currentId = typeof item === 'object' ? String(item.id).trim() : String(item).trim();
            return currentId !== targetIdStr;
        }));
        showToast("Invocazione rimossa");
    };

    const toggleWarlockInvocation = (invId) => {
        const newInvocations = (charData.invocations || []).map(item => {
            const currentItem = typeof item === 'string' ? { id: item, isWarlock: false } : { ...item };
            if (currentItem.id === invId) {
                currentItem.isWarlock = !currentItem.isWarlock;
            }
            return currentItem;
        });
        updateCharData('invocations', newInvocations);
    };
    
    const toggleSpellcasting = (scName) => {
        const current = deduplicateStringList(charData.spellcasting || []);
        const scLower = scName.trim().toLowerCase();
        const exists = current.some(n => n.trim().toLowerCase() === scLower);
        if (exists) {
            updateCharData('spellcasting', current.filter(n => n.trim().toLowerCase() !== scLower));
        } else {
            updateCharData('spellcasting', [...current, scName]);
        }
    };

    const toggleSkill = (skillName, type) => {
        const current = (charData.skills && charData.skills[skillName]) || { isProficient: false, isClassSkill: false, isExpert: false };
        let updated = { ...current };
        if (type === 'prof') {
            updated.isProficient = !current.isProficient;
            if (!updated.isProficient) { updated.isClassSkill = false; updated.isExpert = false; }
        } else if (type === 'class') updated.isClassSkill = !current.isClassSkill;
        else if (type === 'expert') updated.isExpert = !current.isExpert;
        updateCharData('skills', { ...(charData.skills || {}), [skillName]: updated });
    };

    const toggleSavingThrow = (stat) => {
        const current = charData.savingThrows || {};
        updateCharData('savingThrows', { ...current, [stat]: !current[stat] });
    };
    
    // --- LOBBY ACTIONS ---
    const selectCharacter = (name) => {
        setCurrentProfile(name);
        setView('editor');
        showToast(`Caricato: ${name}`, 'info');
    };

    const handleCreateProfile = () => {
        setCreateModal({
            name: '',
            level: 1,
            cpPerLevel: 12.5,
            themeColor: 'blue'
        });
    };

    const confirmCreateProfile = () => {
        const { name, level, cpPerLevel, themeColor } = createModal;
        const cleanName = name.trim();
        if (!cleanName) {
            setAlertModal({ title: "Errore", message: "Inserisci un nome valido." });
            return;
        }
        if (profiles.includes(cleanName)) {
            setAlertModal({ title: "Errore", message: `Esiste già un personaggio chiamato "${cleanName}".` });
            return;
        }

        const newProfiles = [...profiles, cleanName];
        setProfiles(newProfiles);
        localStorage.setItem('d20_profiles', JSON.stringify(newProfiles));
        
        const newCharData = migrateAndSanitizeCharacter({
            charPower: { level: level, cpPerLevel: cpPerLevel },
            meta: { themeColor: themeColor }
        });
        localStorage.setItem(`d20_profile_${cleanName}`, JSON.stringify(newCharData));
        setCurrentProfile(cleanName);
        setCreateModal(null);
        setView('editor');
        showToast(`Creato personaggio "${cleanName}"!`);
    };

    const handleDeleteProfile = (name) => {
        if (profiles.length <= 1) {
            setAlertModal({ title: "Attenzione", message: "Devi avere almeno un personaggio salvato." });
            return;
        }
        
        setConfirmModal({
            title: "Elimina Personaggio",
            message: `Sei sicuro di voler eliminare permanentemente il personaggio "${name}"? Questa azione non può essere annullata.`,
            confirmText: "Elimina",
            cancelText: "Annulla",
            isDanger: true,
            onConfirm: () => {
                const newProfiles = profiles.filter(p => p !== name);
                localStorage.removeItem(`d20_profile_${name}`);
                setProfiles(newProfiles);
                localStorage.setItem('d20_profiles', JSON.stringify(newProfiles));
                if (currentProfile === name) {
                    setCurrentProfile(newProfiles[0]);
                }
                showToast(`Personaggio "${name}" eliminato.`);
            }
        });
    };
    
    const openDuplicateModal = (name) => {
        setDuplicateModal({
            sourceName: name,
            name: `${name} (Copia)`
        });
    };

    const confirmDuplicate = () => {
        const { sourceName, name } = duplicateModal;
        const cleanName = name.trim();
        if (!cleanName || profiles.includes(cleanName)) {
            setAlertModal({ title: "Errore", message: "Nome non valido o già esistente." });
            return;
        }

        const sourceDataStr = localStorage.getItem(`d20_profile_${sourceName}`);
        if (!sourceDataStr) return;

        const newProfiles = [...profiles, cleanName];
        setProfiles(newProfiles);
        localStorage.setItem('d20_profiles', JSON.stringify(newProfiles));
        
        // Clona e aggiorna il nome nel meta se necessario
        const clonedData = migrateAndSanitizeCharacter(JSON.parse(sourceDataStr));
        localStorage.setItem(`d20_profile_${cleanName}`, JSON.stringify(clonedData));
        
        setDuplicateModal(null);
        showToast(`Duplicato come "${cleanName}"`);
    };

    const openRenameModal = (name) => {
        setRenameModal({
            oldName: name,
            name: name
        });
    };

    const confirmRename = () => {
        const { oldName, name } = renameModal;
        const cleanName = name.trim();
        if (!cleanName || (cleanName !== oldName && profiles.includes(cleanName))) {
            setAlertModal({ title: "Errore", message: "Nome non valido o già in uso." });
            return;
        }

        if (cleanName === oldName) {
            setRenameModal(null);
            return;
        }

        const newProfiles = profiles.map(p => p === oldName ? cleanName : p);
        setProfiles(newProfiles);
        localStorage.setItem('d20_profiles', JSON.stringify(newProfiles));
        
        const data = localStorage.getItem(`d20_profile_${oldName}`);
        localStorage.setItem(`d20_profile_${cleanName}`, data);
        localStorage.removeItem(`d20_profile_${oldName}`);
        
        if (currentProfile === oldName) {
            setCurrentProfile(cleanName);
        }

        setRenameModal(null);
        showToast(`Rinominato in "${cleanName}"`);
    };

    // --- TEXT SUMMARY EXPORT ---
    const handleExportSummary = () => {
        const { level } = charData.charPower;
        
        let text = `=== D20 REVOLUTION - RIEPILOGO PERSONAGGIO ===\n`;
        text += `Nome: ${currentProfile}\n`;
        text += `Livello: ${level}\n`;
        text += `CP Utilizzati: ${totalCPSpent} / ${totalCPAvailable}\n`;
        text += `==============================================\n\n`;

        text += `--- STATISTICHE ---\n`;
        Object.keys(charData.stats).forEach(stat => {
            const final = calculateFinalScore(charData.stats[stat]);
            const mod = getAbilityMod(final);
            const save = charData.savingThrows[stat] ? " [Proficiente]" : "";
            text += `${stat}: ${final} (${mod >= 0 ? '+' : ''}${mod})${save}\n`;
        });
        text += `\n`;

        text += `--- CLASSI & HP ---\n`;
        const hpClass = charData.classes.find(c => c.showProficiency);
        const currentHpPerLevel = hpClass ? (hpClass.selectedHp || getHpPerLevel(hpClass.className)) : 0;
        
        if (currentHpPerLevel > 0) text += `HP Scelti per Livello: ${currentHpPerLevel}\n`;
        text += `HP Totali: ${totalHP}\n`;
        
        charData.classes.forEach(c => {
            if(!c.className) return;
            const profInfo = c.showProficiency ? " [Proficiency]" : "";
            text += `- ${c.className} (Lv ${c.level})${profInfo}\n`;
        });
        text += `\n`;

        text += `--- ABILITÀ (SKILLS) ---\n`;
        SKILLS_DATA.forEach(skill => {
            const s = charData.skills[skill.name];
            if (s && s.isProficient) {
                const expert = s.isExpert ? " (Expertise)" : "";
                const classSk = s.isClassSkill ? " [Class Skill]" : "";
                text += `- ${skill.name}${expert}${classSk}\n`;
            }
        });
        text += `\n`;

        text += `--- TALENTI (FEATS) ---\n`;
        const exportFeats = deduplicateNamedList(charData.feats || []);
        if(exportFeats.length === 0) text += `(Nessuno)\n`;
        exportFeats.forEach(f => {
            text += `- ${f.name} (${f.cost} CP)\n`;
        });
        text += `\n`;

        text += `--- CLASS FEATURES ---\n`;
        const exportFeatures = deduplicateFeaturesList(charData.features || []);
        if(exportFeatures.length === 0) text += `(Nessuna)\n`;
        exportFeatures.forEach(f => {
            const featObj = (typeof f === 'object') ? f : dbMap[f];
            if (featObj) text += `- ${featObj.name} (${featObj.cp} CP)\n`;
        });
        text += `\n`;

        text += `--- COMBAT ---\n`;
        const exportStyles = deduplicateNamedList(charData.fightingStyles || []);
        if (exportStyles.length) {
            text += `Fighting Styles:\n`;
            exportStyles.forEach(style => {
                text += `  * ${style.name}\n`;
            });
        }
        const exportStrikes = deduplicateNamedList(charData.cunningStrikes || []);
        if (exportStrikes.length) {
            text += `Cunning Strikes:\n`;
            exportStrikes.forEach(strike => {
                text += `  * ${strike.name}\n`;
            });
        }
        text += `\n`;

        text += `--- MAGIC ---\n`;
        const exportSc = deduplicateStringList(charData.spellcasting || []);
        if (exportSc.length) {
            text += `Spellcasting Classes: ${exportSc.join(', ').replace(/Spellcasting, /g, '')}\n`;
        }
        const totalCasterLevel = (charData.magic.casterSlots || []).reduce((acc, slot, idx) => {
            if (!slot || !slot.active) return acc;
            return acc + calculateCasterLevel(CASTER_SLOTS_CONFIG[idx].type, slot.level);
        }, 0);
        if (totalCasterLevel > 0) text += `Total Caster Level: ${totalCasterLevel}\n`;
        
        const exportPsiPowers = deduplicateNamedList(charData.psionicPowers || []);
        if (hasPsionicPowerFeature && exportPsiPowers.length) {
            text += `Poteri Psionici (Psionic Power - Costo 2 CP ciascuno):\n`;
            exportPsiPowers.forEach(power => {
                text += `  * ${power.name} [${power.action || '1 AP'}]: ${power.desc}\n`;
            });
            text += `\n`;
        }
        
        const exportPsiDisc = deduplicateNamedList(charData.psionicDisciplines || []);
        if (hasPsionicDisciplineFeature && exportPsiDisc.length) {
            text += `Discipline Psioniche (Psionic Discipline - Costo 2 CP ciascuna):\n`;
            exportPsiDisc.forEach(disc => {
                text += `  * ${disc.name} [${disc.action || 'Passive'}]: ${disc.desc}\n`;
            });
            text += `\n`;
        }
        
        const exportManeuvers = deduplicateNamedList(charData.maneuvers || []);
        if (exportManeuvers.length) {
            text += `Martial Adept (Battle Maneuvers):\n`;
            exportManeuvers.forEach(item => {
                const isFighter = typeof item === 'object' ? item.isFighter : false;
                const m = typeof item === 'object' ? item : (maneuversMap[item] || (maneuversDb || []).find(x => x.id === item));
                if (m) text += `  * ${m.name} [${m.action || 'Passiva'}]${isFighter ? ' (Fighter - Free)' : ''}: ${m.desc}\n`;
            });
            text += `\n`;
        }

        const exportMetamagic = deduplicateNamedList(charData.metamagic || []);
        if (exportMetamagic.length) {
            text += `Metamagic:\n`;
            exportMetamagic.forEach(item => {
                const isSorcerer = typeof item === 'object' ? item.isSorcerer : false;
                const m = typeof item === 'object' ? item : metamagicMap[item];
                if (m) text += `  * ${m.name}${isSorcerer ? ' (Sorcerer - Free)' : ''}\n`;
            });
            text += `\n`;
        }

        const exportInvocations = deduplicateNamedList(charData.invocations || []);
        if (exportInvocations.length) {
            text += `Eldritch Adept (Eldritch Invocations):\n`;
            exportInvocations.forEach(item => {
                const isWarlock = typeof item === 'object' ? item.isWarlock : false;
                const inv = typeof item === 'object' ? item : (invocationsMap[item] || (invocationsDb || []).find(x => x.id === item));
                if (inv) text += `  * ${inv.name} [${inv.action || 'Passiva'}]${isWarlock ? ' (Warlock - Free)' : ''}: ${inv.desc}\n`;
            });
            text += `\n`;
        }
        
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${currentProfile.replace(/\s+/g, '_')}_summary.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Riepilogo TXT scaricato!");
    };

    // --- JSON EXPORT ---
    const handleDownloadSave = (single = false, name = currentProfile) => {
        let saveData;
        let filename;
        if (single) {
            const dataStr = localStorage.getItem(`d20_profile_${name}`);
            const dataObj = dataStr ? JSON.parse(dataStr) : charData;
            const sanitized = migrateAndSanitizeCharacter(dataObj);
            sanitized.savedCPSpent = (name === currentProfile) ? totalCPSpent : calculateCharacterCPSpent(sanitized, dbMap, proficiencyMap);
            saveData = { 
                schemaVersion: CURRENT_SCHEMA_VERSION,
                type: 'single_character', 
                profileName: name, 
                data: sanitized, 
                date: new Date().toISOString() 
            };
            filename = `d20_${name.replace(/\s+/g,'_')}.json`;
        } else {
            const sanitizedProfilesData = profiles.reduce((acc, p) => {
                const pStr = localStorage.getItem(`d20_profile_${p}`);
                const pObj = pStr ? JSON.parse(pStr) : (p === currentProfile ? charData : {});
                const sanitized = migrateAndSanitizeCharacter(pObj);
                sanitized.savedCPSpent = (p === currentProfile) ? totalCPSpent : calculateCharacterCPSpent(sanitized, dbMap, proficiencyMap);
                acc[p] = sanitized;
                return acc;
            }, {});

            saveData = { 
                schemaVersion: CURRENT_SCHEMA_VERSION,
                type: 'full_backup', 
                db: db, 
                featsDb: featsDb, 
                profiles: profiles, 
                profilesData: sanitizedProfilesData, 
                date: new Date().toISOString() 
            };
            filename = `d20_backup_full_${new Date().toISOString().slice(0,10)}.json`;
        }

        const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: "application/json" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(single ? "File personaggio scaricato!" : "Backup completo scaricato!");
    };

    // --- SEND TO MASTER (GOOGLE DRIVE & SHEETS) ---
    const executeSendToMaster = async (targetProfileName, inputPlayerName) => {
        const profileName = (targetProfileName || currentProfile || '').trim();
        const cleanPlayerName = (inputPlayerName || '').trim();
        
        if (!cleanPlayerName) {
            setAlertModal({ title: "Nome Giocatore Mancante", message: "Inserisci il nome del giocatore per procedere con l'invio al Master." });
            return;
        }
        if (!profileName) {
            setAlertModal({ title: "Errore Personaggio", message: "Nessun personaggio selezionato o nome non valido." });
            return;
        }

        let charObj;
        if (profileName === currentProfile) {
            charObj = { ...charData };
        } else {
            const rawStr = localStorage.getItem(`d20_profile_${profileName}`);
            charObj = rawStr ? JSON.parse(rawStr) : {};
        }

        const sanitized = migrateAndSanitizeCharacter(charObj);
        sanitized.savedCPSpent = (profileName === currentProfile) ? totalCPSpent : calculateCharacterCPSpent(sanitized, dbMap, proficiencyMap);
        sanitized.name = profileName;
        sanitized.profileName = profileName;
        sanitized.playerName = cleanPlayerName;
        sanitized.meta = { ...(sanitized.meta || {}), playerName: cleanPlayerName };

        // Persisti playerName nel profilo
        if (profileName === currentProfile) {
            updateCharData('meta', sanitized.meta);
        } else {
            localStorage.setItem(`d20_profile_${profileName}`, JSON.stringify(sanitized));
        }

        setIsSubmittingToMaster(true);
        setSendToMasterModal(null);

        try {
            const payload = {
                playerName: cleanPlayerName,
                character: sanitized
            };

            await fetch(MASTER_WEBAPP_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload)
            });

            showToast("Scheda inviata con successo al Master! Il file è stato registrato nel Drive della campagna.", "success");
        } catch (err) {
            console.error("Errore durante l'invio al Master:", err);
            setAlertModal({
                title: "Errore di Connessione",
                message: "Impossibile inviare la scheda al Google Drive/Sheets del Master a causa di un errore di rete.\n\nVerifica la connessione internet e riprova, oppure scarica la scheda tramite 'Esporta JSON' per consegnarla a mano."
            });
            showToast("Errore di rete nell'invio al Master", "error");
        } finally {
            setIsSubmittingToMaster(false);
        }
    };

    const handleSendToMasterClick = (e, targetName = currentProfile) => {
        let currentTargetData;
        if (targetName === currentProfile) {
            currentTargetData = charData;
        } else {
            const rawStr = localStorage.getItem(`d20_profile_${targetName}`);
            currentTargetData = rawStr ? JSON.parse(rawStr) : {};
        }

        const savedPlayerName = (currentTargetData?.meta?.playerName || "").trim();
        
        // Se shift cliccato o se playerName non è ancora definito, apri modale di inserimento
        if (!savedPlayerName || (e && e.shiftKey)) {
            setSendToMasterModal({
                targetProfile: targetName,
                playerName: savedPlayerName
            });
        } else {
            executeSendToMaster(targetName, savedPlayerName);
        }
    };

    // --- SECURE IMPORT PREVIEW & PROCESS ---
    const handleLoadSaveClick = () => {
        fileInputRef.current.click();
    };

    const handleLoadSaveFileSelected = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = JSON.parse(e.target.result);
                
                // 1. IMPORTING SINGLE CHARACTER (Supports wrapped single_character or direct character object)
                let singleCharData = null;
                let originalName = null;

                if (content.type === 'single_character') {
                    singleCharData = content.data || {};
                    originalName = content.profileName || singleCharData.name || 'Personaggio';
                } else if (!content.type && (content.classes || content.stats || content.charPower || content.features)) {
                    singleCharData = content;
                    originalName = content.name || content.profileName || 'Personaggio';
                }

                if (singleCharData) {
                    const sanitized = migrateAndSanitizeCharacter(singleCharData);
                    const hasConflict = profiles.includes(originalName);
                    
                    // Genera nome suggerito non in conflitto
                    let suggestedName = `${originalName} (Importato)`;
                    let counter = 2;
                    while (profiles.includes(suggestedName)) {
                        suggestedName = `${originalName} (Importato ${counter})`;
                        counter++;
                    }

                    // Verifica discrepanza CP tra salvataggio precedente e ricalcolo con regole attuali
                    const calculatedCP = calculateCharacterCPSpent(sanitized, dbMap, proficiencyMap);
                    const previousCP = singleCharData.savedCPSpent ?? content.savedCPSpent ?? singleCharData.cpSpent ?? content.cpSpent;
                    let cpDiff = null;
                    if (previousCP !== undefined && previousCP !== null && !isNaN(previousCP) && previousCP !== calculatedCP) {
                        cpDiff = { old: previousCP, new: calculatedCP };
                    }

                    // Apri il modal di anteprima dell'importazione
                    setImportPreviewModal({
                        type: 'single_character',
                        name: originalName,
                        level: sanitized.charPower.level,
                        classesText: (sanitized.classes || []).map(c => `${c.className} (Lv ${c.level})`).join(', ') || 'Nessuna Classe',
                        rawData: sanitized,
                        isConflict: hasConflict,
                        importName: hasConflict ? suggestedName : originalName,
                        overwrite: false,
                        cpDiff: cpDiff
                    });
                } 
                
                // 2. IMPORTING FULL BACKUP
                else if (content.db && content.profiles) {
                    const listText = content.profiles.join(', ');
                    setImportPreviewModal({
                        type: 'full_backup',
                        profileCount: content.profiles.length,
                        profilesListText: listText,
                        rawData: content
                    });
                } else {
                    setAlertModal({ title: "Formato non valido", message: "Il file JSON selezionato non corrisponde ad un salvataggio D20 Revolution valido." });
                }
            } catch (error) { 
                console.error(error);
                setAlertModal({ title: "Errore Lettura File", message: "Verifica che il file selezionato sia in formato JSON valido." });
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    };

    const confirmImportSingleCharacter = () => {
        const { importName, rawData, overwrite, cpDiff } = importPreviewModal;
        const targetName = importName.trim();

        if (!targetName) {
            setAlertModal({ title: "Errore", message: "Inserisci un nome valido per il personaggio." });
            return;
        }

        if (!overwrite && profiles.includes(targetName)) {
            setAlertModal({ title: "Conflitto Nome", message: `Esiste già un personaggio chiamato "${targetName}". Cambia nome o seleziona Sovrascrivi.` });
            return;
        }

        const sanitized = migrateAndSanitizeCharacter(rawData);
        localStorage.setItem(`d20_profile_${targetName}`, JSON.stringify(sanitized));
        
        if (!profiles.includes(targetName)) {
            const newProfiles = [...profiles, targetName];
            setProfiles(newProfiles);
            localStorage.setItem('d20_profiles', JSON.stringify(newProfiles));
        }

        setCurrentProfile(targetName);
        setImportPreviewModal(null);
        setView('editor');
        showToast(`Personaggio "${targetName}" importato!`);

        if (cpDiff) {
            setTimeout(() => {
                showToast(`Scheda aggiornata: CP ricalcolati (Precedente: ${cpDiff.old} CP, Attuale: ${cpDiff.new} CP)`, 'info');
            }, 600);
        }
    };

    const confirmImportFullBackup = () => {
        const content = importPreviewModal.rawData;

        setDb(content.db);
        localStorage.setItem('d20_db_data', JSON.stringify(content.db));
        if (content.featsDb) { 
            setFeatsDb(content.featsDb); 
            localStorage.setItem('d20_feats_db', JSON.stringify(content.featsDb)); 
        }
        
        setProfiles(content.profiles);
        localStorage.setItem('d20_profiles', JSON.stringify(content.profiles));
        
        if (content.profilesData) {
            Object.keys(content.profilesData).forEach(p => {
                const sanitized = migrateAndSanitizeCharacter(content.profilesData[p]);
                localStorage.setItem(`d20_profile_${p}`, JSON.stringify(sanitized));
            });
        }
        
        setCurrentProfile(content.profiles[0]);
        setImportPreviewModal(null);
        setView('lobby');
        showToast("Backup ripristinato con successo!");
    };

    const loadDefaultDatabases = () => {
        localStorage.removeItem('d20_fighting_styles_db');
        parseFeaturesCSV(PRELOADED_CSV);
        parseFeatsCSV(PRELOADED_FEATS_CSV);
        parseFightingStylesCSV(PRELOADED_FIGHTING_STYLES_CSV);
        parseCunningStrikesCSV(PRELOADED_CUNNING_STRIKES_CSV);
        parseMetamagicCSV(PRELOADED_METAMAGIC_CSV);
        if (typeof PRELOADED_PSIONIC_POWERS_CSV !== 'undefined') parsePsionicPowersCSV(PRELOADED_PSIONIC_POWERS_CSV);
        if (typeof PRELOADED_PSIONIC_DISCIPLINES_CSV !== 'undefined') parsePsionicDisciplinesCSV(PRELOADED_PSIONIC_DISCIPLINES_CSV);
        if (typeof PRELOADED_ELD_INVOCATIONS_CSV !== 'undefined') parseInvocationsCSV(PRELOADED_ELD_INVOCATIONS_CSV);
        
        Papa.parse(PRELOADED_PROFICIENCY_CSV, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                 const parsedProf = results.data.map(row => ({
                         name: row["Name"],
                         className: row["Class"],
                         cost: parseInt(row["Cost"]),
                         desc: row["Description"]
                 }));
                 setProficiencyDb(parsedProf);
            }
        });
        showToast("Database ripristinati!");
    };

    const handleResetDB = () => {
        setConfirmModal({
            title: "Ripristina Database Default",
            message: "Sei sicuro di voler ripristinare i database precaricati delle classi e dei talenti alle versioni predefinite?",
            confirmText: "Ripristina",
            cancelText: "Annulla",
            onConfirm: () => {
                loadDefaultDatabases();
                setShowImport(false);
            }
        });
    };

    const handleImportCSV = () => {
        if (!csvText.trim()) return;
        try {
            if (importType === 'features') parseFeaturesCSV(csvText);
            else if (importType === 'feats') parseFeatsCSV(csvText);
            setShowImport(false);
            setCsvText('');
            showToast("CSV caricato con successo!");
        } catch (e) { 
            setAlertModal({ title: "Errore CSV", message: "Si è verificato un errore durante la lettura del CSV. Controlla il formato." });
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-sans antialiased overflow-hidden">
            {/* FILE INPUT NASCOSTO PER IMPORT JSON */}
            <input type="file" ref={fileInputRef} style={{display: 'none'}} accept=".json" onChange={handleLoadSaveFileSelected} />

            {/* TOAST SYSTEM */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
                {toasts.map(t => (
                    <div key={t.id} className={`p-4 rounded-xl shadow-2xl border flex items-center justify-between pointer-events-auto animate-in slide-in-from-top duration-300 ${
                        t.type === 'error' ? 'bg-red-950/90 border-red-800 text-red-200' :
                        t.type === 'info' ? 'bg-slate-900/90 border-slate-700 text-blue-300' :
                        'bg-slate-900/95 border-emerald-500/30 text-emerald-400'
                    }`}>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            {t.type === 'error' ? <Icons.AlertCircle /> : <Icons.Check />}
                            <span>{t.text}</span>
                        </div>
                        <button onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))} className="text-slate-500 hover:text-white ml-4">
                            <Icons.X />
                        </button>
                    </div>
                ))}
            </div>

            {/* REUSABLE CONFIRM MODAL */}
            {confirmModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            {confirmModal.isDanger && <span className="text-red-500"><Icons.AlertCircle /></span>}
                            {confirmModal.title}
                        </h3>
                        <p className="text-slate-400 text-sm mb-6 whitespace-pre-wrap">{confirmModal.message}</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setConfirmModal(null)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm font-semibold">
                                {confirmModal.cancelText || "Annulla"}
                            </button>
                            <button 
                                onClick={() => {
                                    confirmModal.onConfirm();
                                    setConfirmModal(null);
                                }} 
                                className={`px-5 py-2 rounded-xl text-white font-bold text-sm transition-colors shadow-lg ${confirmModal.isDanger ? 'bg-red-600 hover:bg-red-500 shadow-red-900/30' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'}`}
                            >
                                {confirmModal.confirmText || "Conferma"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REUSABLE ALERT MODAL */}
            {alertModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2 text-red-400">
                            <Icons.AlertCircle />
                            {alertModal.title}
                        </h3>
                        <p className="text-slate-300 text-sm mb-6">{alertModal.message}</p>
                        <div className="flex justify-end">
                            <button onClick={() => setAlertModal(null)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-blue-900/30">
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LOBBY / LIBRARY VIEW */}
            {view === 'lobby' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <header className="bg-slate-900/80 backdrop-blur border-b border-slate-850 p-6 flex-shrink-0 z-10">
                        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-8">
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                                    <span className="bg-blue-600 w-3 h-8 rounded-full"></span> D20 Revolution Builder
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">v0.70</span>
                                </h1>
                                <p className="text-xs text-slate-500 mt-1">Libreria dei tuoi personaggi e strumenti di backup.</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={handleLoadSaveClick} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all border border-slate-750">
                                    <Icons.FolderOpen /> Importa PG
                                </button>
                                <button onClick={() => handleDownloadSave(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-350 text-xs font-bold rounded-xl flex items-center gap-2 transition-all border border-slate-750" title="Scarica backup completo di tutti i PG">
                                    <Icons.Save /> Backup Completo
                                </button>
                                <button onClick={() => { setShowImport(true); setCsvText(''); }} className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-900/20">
                                    <Icons.Sliders /> Gestisci Database
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Main library body */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                        <div className="w-full px-4 md:px-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Icons.Users /> I tuoi Eroi ({profiles.length})
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                                {/* CARD: NUOVO PERSONAGGIO */}
                                <div 
                                    onClick={handleCreateProfile}
                                    className="bg-slate-900/30 border-2 border-dashed border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/50 transition-all rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer min-h-[220px] group text-center"
                                >
                                    <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 group-hover:border-blue-500/30 group-hover:bg-blue-600/10 flex items-center justify-center mb-4 transition-all text-slate-500 group-hover:text-blue-400">
                                        <Icons.Plus />
                                    </div>
                                    <span className="font-bold text-slate-400 group-hover:text-white transition-colors text-sm">Crea Nuovo Personaggio</span>
                                    <span className="text-xs text-slate-650 mt-1">Configura un nuovo eroe da zero.</span>
                                </div>

                                {/* CARDS DEI PG SALVATI */}
                                {profiles.map(name => {
                                    // Leggi dati character card per preview
                                    const dataStr = localStorage.getItem(`d20_profile_${name}`);
                                    let preview = { level: 1, cpSpent: 0, cpAvail: 12.5, hp: 10, classes: [], theme: 'blue' };
                                    if (dataStr) {
                                        try {
                                            const raw = JSON.parse(dataStr);
                                            const p = migrateAndSanitizeCharacter(raw);
                                            preview.level = p.charPower?.level || 1;
                                            preview.cpAvail = Math.ceil(preview.level * (p.charPower?.cpPerLevel || 12.5));
                                            preview.classes = p.classes || [];
                                            preview.theme = p.meta?.themeColor || 'blue';
                                            
                                            // HP
                                            const conVal = calculateFinalScore(p.stats?.CON);
                                            const conModVal = getAbilityMod(conVal);
                                            const hpCls = preview.classes.find(c => c.showProficiency);
                                            const hpPerLvl = hpCls ? (hpCls.selectedHp || getHpPerLevel(hpCls.className)) : 0;
                                            preview.hp = (hpPerLvl + conModVal) * preview.level;

                                            preview.cpSpent = calculateCharacterCPSpent(p, dbMap, proficiencyMap);
                                        } catch (e) {
                                            console.error("Errore nel parsing per lobby preview", e);
                                        }
                                    }

                                    const theme = getThemeColor(preview.theme);
                                    const classText = preview.classes.length > 0 
                                        ? preview.classes.map(c => `${c.className} ${c.level}`).join(' / ') 
                                        : 'Nessuna Classe';

                                    return (
                                        <div 
                                            key={name}
                                            className={`bg-slate-900 border border-slate-850 hover:border-slate-700/80 rounded-2xl p-6 relative flex flex-col justify-between shadow-xl hover:${theme.glow} transition-all duration-300 border-l-4 ${preview.theme === 'blue' ? 'border-l-blue-500' : preview.theme === 'amber' ? 'border-l-amber-500' : preview.theme === 'emerald' ? 'border-l-emerald-500' : preview.theme === 'purple' ? 'border-l-purple-500' : preview.theme === 'rose' ? 'border-l-rose-500' : 'border-l-indigo-500'}`}
                                        >
                                            {/* Top corner dropdown menu / actions */}
                                            <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/40">
                                                <button onClick={() => openRenameModal(name)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-blue-400 transition-colors" title="Rinomina">
                                                    <Icons.Edit />
                                                </button>
                                                <button onClick={() => openDuplicateModal(name)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-purple-400 transition-colors" title="Duplica">
                                                    <Icons.Copy />
                                                </button>
                                                <button onClick={() => handleDownloadSave(true, name)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-emerald-400 transition-colors" title="Esporta JSON">
                                                    <Icons.Download />
                                                </button>
                                                <button onClick={(e) => handleSendToMasterClick(e, name)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-amber-400 transition-colors" title="Invia al Master">
                                                    <Icons.Send />
                                                </button>
                                                <button onClick={() => handleDeleteProfile(name)} className="p-1 rounded hover:bg-slate-800/50 text-slate-550 hover:text-red-400 transition-colors" title="Elimina">
                                                    <Icons.Trash />
                                                </button>
                                            </div>

                                            {/* Details */}
                                            <div className="mb-6 cursor-pointer" onClick={() => selectCharacter(name)}>
                                                <div className="flex items-center gap-2 mb-2 pr-28">
                                                    <h3 className="font-bold text-white text-lg truncate" title={name}>{name}</h3>
                                                </div>
                                                
                                                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-950/60 rounded-lg text-slate-400 border border-slate-850">
                                                    Livello {preview.level}
                                                </span>

                                                <p className="text-xs text-slate-500 font-medium truncate mt-4">
                                                    {classText}
                                                </p>
                                            </div>

                                            {/* Stats summary & buttons */}
                                            <div className="border-t border-slate-800/60 pt-4 flex flex-col gap-3">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 uppercase font-bold tracking-wider">Creation Points</span>
                                                    <span className={`font-mono font-bold ${preview.cpSpent > preview.cpAvail ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {preview.cpSpent} <span className="text-slate-650">/</span> {preview.cpAvail} CP
                                                    </span>
                                                </div>
                                                
                                                {/* Mini progress bar */}
                                                <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full transition-all ${preview.cpSpent > preview.cpAvail ? 'bg-red-500' : preview.theme === 'blue' ? 'bg-blue-500' : preview.theme === 'amber' ? 'bg-amber-500' : preview.theme === 'emerald' ? 'bg-emerald-500' : preview.theme === 'purple' ? 'bg-purple-500' : preview.theme === 'rose' ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                                        style={{ width: `${Math.min(100, (preview.cpSpent / preview.cpAvail) * 100)}%` }}
                                                    ></div>
                                                </div>

                                                <div className="flex items-center justify-between text-xs text-slate-450 mt-1">
                                                    <span className="flex items-center gap-1"><Icons.Heart /> <span className="font-mono font-bold">{preview.hp} HP</span></span>
                                                    <button 
                                                        onClick={() => selectCharacter(name)}
                                                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700/80 hover:text-white rounded-lg text-xs font-bold transition-all"
                                                    >
                                                        Apri Builder
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATION MODAL */}
            {createModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Icons.Plus className="text-blue-500" /> Nuovo Personaggio
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1">NOME PERSONAGGIO</label>
                                <input 
                                    type="text" 
                                    placeholder="Es: Victor"
                                    value={createModal.name}
                                    onChange={(e) => setCreateModal({ ...createModal, name: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none text-sm"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 block mb-1">LIVELLO INIZIALE</label>
                                    <select 
                                        value={createModal.level}
                                        onChange={(e) => setCreateModal({ ...createModal, level: parseInt(e.target.value) || 1 })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none text-sm font-semibold"
                                    >
                                        {Array.from({length: 40}, (_, i) => i + 1).map(lvl => (
                                            <option key={lvl} value={lvl}>Lv. {lvl}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 block mb-1">CP PER LIVELLO</label>
                                    <input 
                                        type="number" 
                                        step="0.5"
                                        value={createModal.cpPerLevel}
                                        onChange={(e) => setCreateModal({ ...createModal, cpPerLevel: parseFloat(e.target.value) || 12.5 })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none text-sm font-mono font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-2">TEMA COLORE</label>
                                <div className="flex gap-2.5 justify-between">
                                    {THEME_COLORS.map(c => (
                                        <button 
                                            key={c.key} 
                                            onClick={() => setCreateModal({ ...createModal, themeColor: c.key })}
                                            className={`w-9 h-9 rounded-full ${c.bg} transition-transform ${createModal.themeColor === c.key ? 'scale-110 ring-4 ring-slate-800' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                                            title={c.label}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setCreateModal(null)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-colors">
                                Annulla
                            </button>
                            <button onClick={confirmCreateProfile} className="px-5 py-2 bg-blue-650 hover:bg-blue-650/90 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-blue-900/30">
                                Crea Personaggio
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RENAME MODAL */}
            {renameModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-white mb-4">Rinomina Profilo</h3>
                        <input 
                            type="text" 
                            value={renameModal.name}
                            onChange={(e) => setRenameModal({ ...renameModal, name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none text-sm font-semibold mb-4"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setRenameModal(null)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-semibold">Annulla</button>
                            <button onClick={confirmRename} className="px-5 py-2 bg-blue-650 hover:bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-900/30">Conferma</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DUPLICATE MODAL */}
            {duplicateModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-white mb-4">Duplica Profilo</h3>
                        <input 
                            type="text" 
                            value={duplicateModal.name}
                            onChange={(e) => setDuplicateModal({ ...duplicateModal, name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none text-sm font-semibold mb-4"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDuplicateModal(null)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-semibold">Annulla</button>
                            <button onClick={confirmDuplicate} className="px-5 py-2 bg-blue-650 hover:bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-900/30">Duplica</button>
                        </div>
                    </div>
                </div>
            )}

            {/* IMPORT PREVIEW MODAL */}
            {importPreviewModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        
                        {importPreviewModal.type === 'single_character' ? (
                            <div>
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <Icons.Upload className="text-blue-400" /> Anteprima Importazione Personaggio
                                </h3>
                                
                                <div className="bg-slate-950/65 rounded-xl border border-slate-800 p-4 mb-5 flex flex-col gap-2">
                                    <div><span className="text-[10px] text-slate-500 font-bold uppercase block">Nome Originale</span><span className="text-white font-bold">{importPreviewModal.name}</span></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><span className="text-[10px] text-slate-500 font-bold uppercase block">Livello</span><span className="text-slate-300 font-mono font-bold">Lv. {importPreviewModal.level}</span></div>
                                        <div><span className="text-[10px] text-slate-500 font-bold uppercase block">Classi</span><span className="text-slate-350 text-xs truncate block">{importPreviewModal.classesText}</span></div>
                                    </div>
                                </div>

                                {importPreviewModal.cpDiff && (
                                    <div className="bg-blue-950/40 border border-blue-800 text-blue-200 rounded-xl p-3 mb-4 text-xs flex items-center gap-2">
                                        <Icons.AlertCircle className="text-blue-400 shrink-0" />
                                        <span>Ricalcolo CP versione: precedentemente <strong>{importPreviewModal.cpDiff.old} CP</strong>, ricalcolati con regole attuali <strong>{importPreviewModal.cpDiff.new} CP</strong>.</span>
                                    </div>
                                )}

                                {importPreviewModal.isConflict && (
                                    <div className="bg-amber-955/20 border border-amber-900 text-amber-200 rounded-xl p-4 mb-4 flex flex-col gap-3">
                                        <div className="text-xs font-semibold flex items-center gap-2">
                                            <Icons.AlertCircle className="text-amber-500" />
                                            <span>Un personaggio chiamato &quot;{importPreviewModal.name}&quot; è già presente nella tua libreria.</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer">
                                                <input 
                                                    type="radio" 
                                                    checked={!importPreviewModal.overwrite} 
                                                    onChange={() => setImportPreviewModal({ ...importPreviewModal, overwrite: false })} 
                                                    className="accent-blue-500" 
                                                />
                                                Carica come Copia
                                            </label>
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-450 cursor-pointer">
                                                <input 
                                                    type="radio" 
                                                    checked={importPreviewModal.overwrite} 
                                                    onChange={() => setImportPreviewModal({ ...importPreviewModal, overwrite: true })} 
                                                    className="accent-red-500" 
                                                />
                                                Sovrascrivi
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {!importPreviewModal.overwrite && (
                                    <div className="mb-6">
                                        <label className="text-[10px] font-bold text-slate-400 block mb-1">NOME DA IMPORTARE</label>
                                        <input 
                                            type="text"
                                            value={importPreviewModal.importName}
                                            onChange={(e) => setImportPreviewModal({ ...importPreviewModal, importName: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none text-sm font-semibold"
                                        />
                                    </div>
                                )}

                                {importPreviewModal.overwrite && (
                                    <div className="bg-red-950/20 border border-red-900 text-red-200 text-xs p-3.5 rounded-xl mb-6 flex items-center gap-2">
                                        <Icons.AlertCircle className="text-red-500" />
                                        <span>Il personaggio corrente &quot;{importPreviewModal.importName}&quot; verrà eliminato e rimpiazzato con questa versione.</span>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setImportPreviewModal(null)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-colors">
                                        Annulla
                                    </button>
                                    <button 
                                        onClick={confirmImportSingleCharacter}
                                        className={`px-5 py-2 rounded-xl text-white font-bold text-sm shadow-lg transition-colors ${importPreviewModal.overwrite ? 'bg-red-600 hover:bg-red-500 shadow-red-900/30' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'}`}
                                    >
                                        {importPreviewModal.overwrite ? "Sovrascrivi" : "Importa Personaggio"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2 text-amber-500">
                                    <Icons.AlertCircle /> Ripristino Backup Completo
                                </h3>
                                
                                <p className="text-slate-350 text-sm mb-4 leading-relaxed">
                                    Stai importando un backup contenente <span className="text-white font-bold">{importPreviewModal.profileCount} personaggi</span>:
                                </p>

                                <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl max-h-[120px] overflow-y-auto mb-5 text-slate-400 text-xs font-semibold leading-relaxed">
                                    {importPreviewModal.profilesListText}
                                </div>

                                <div className="bg-red-950/30 border border-red-900/60 rounded-xl p-4 mb-6 flex flex-col gap-2">
                                    <div className="text-xs font-bold text-red-300 flex items-center gap-2">
                                        <Icons.AlertCircle className="text-red-500 flex-shrink-0" />
                                        <span>ATTENZIONE: AZIONE DISTRUTTIVA</span>
                                    </div>
                                    <p className="text-[11px] text-red-400/90 leading-relaxed font-semibold">
                                        Questa operazione eliminerà TUTTI i personaggi attualmente configurati nella tua libreria locale e li sostituirà con quelli presenti nel file. Assicurati di aver scaricato un backup dei tuoi PG prima di procedere.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setImportPreviewModal(null)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-colors">
                                        Annulla
                                    </button>
                                    <button 
                                        onClick={confirmImportFullBackup}
                                        className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-red-900/30 animate-pulse"
                                    >
                                        Sovrascrivi e Ripristina Backup
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* SEND TO MASTER MODAL */}
            {sendToMasterModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                <Icons.Send />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white leading-tight">Invia Scheda al Master</h3>
                                <p className="text-xs text-slate-400">Salvataggio Cloud su Google Drive & Sheets</p>
                            </div>
                        </div>

                        <p className="text-slate-350 text-xs mb-4 leading-relaxed">
                            La scheda di <strong className="text-white">{sendToMasterModal.targetProfile}</strong> verrà archiviata direttamente nella cartella Google Drive del Master e registrata sul foglio di calcolo della campagna.
                        </p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Nome Giocatore / Autore <span className="text-amber-400">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="Es: Matteo"
                                    value={sendToMasterModal.playerName}
                                    onChange={(e) => setSendToMasterModal({ ...sendToMasterModal, playerName: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && sendToMasterModal.playerName.trim() && !isSubmittingToMaster) {
                                            executeSendToMaster(sendToMasterModal.targetProfile, sendToMasterModal.playerName);
                                        }
                                    }}
                                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl p-3 text-white outline-none text-sm font-semibold transition-colors"
                                    autoFocus
                                />
                            </div>

                            <div className="bg-slate-950/70 border border-slate-850 rounded-xl p-3 text-xs space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Personaggio:</span>
                                    <span className="text-white font-bold">{sendToMasterModal.targetProfile}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">Livello:</span>
                                    <span className="text-slate-300 font-mono font-semibold">
                                        Lv. {sendToMasterModal.targetProfile === currentProfile ? (charData.charPower?.level || 1) : 1}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setSendToMasterModal(null)} 
                                disabled={isSubmittingToMaster}
                                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-colors"
                            >
                                Annulla
                            </button>
                            <button 
                                onClick={() => executeSendToMaster(sendToMasterModal.targetProfile, sendToMasterModal.playerName)} 
                                disabled={isSubmittingToMaster || !sendToMasterModal.playerName.trim()}
                                className={`px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center gap-2 ${
                                    isSubmittingToMaster || !sendToMasterModal.playerName.trim()
                                        ? 'bg-amber-600/30 text-amber-300/40 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-950/30 active:scale-95'
                                }`}
                            >
                                {isSubmittingToMaster ? (
                                    <>
                                        <Icons.Loader />
                                        <span>Invio in corso...</span>
                                    </>
                                ) : (
                                    <>
                                        <Icons.Send />
                                        <span>Invia al Master</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CSV DB / SETTINGS */}
            {showImport && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Icons.Upload /> Gestione Database CSV</h3>
                        
                        <div className="flex gap-4 mb-4 flex-shrink-0">
                            <label className={`flex-1 p-3.5 rounded-xl border cursor-pointer text-center transition-all ${importType === 'features' ? 'bg-blue-600/10 border-blue-500/80 text-blue-300 font-bold' : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-850'}`}>
                                <input type="radio" value="features" checked={importType === 'features'} onChange={() => setImportType('features')} className="hidden" /> Class Features
                            </label>
                            <label className={`flex-1 p-3.5 rounded-xl border cursor-pointer text-center transition-all ${importType === 'feats' ? 'bg-blue-600/10 border-blue-500/80 text-blue-300 font-bold' : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-850'}`}>
                                <input type="radio" value="feats" checked={importType === 'feats'} onChange={() => setImportType('feats')} className="hidden" /> Talenti (Feats)
                            </label>
                        </div>
                        
                        <div className="mb-4 flex gap-2 flex-shrink-0">
                            <button onClick={() => csvFileInputRef.current.click()} className="flex-1 py-2.5 bg-slate-950 border-2 border-dashed border-slate-850 rounded-xl text-slate-450 hover:border-blue-500 hover:text-blue-400 transition-all flex items-center justify-center gap-2 text-xs font-bold"><Icons.FileText /> Carica File .CSV</button>
                            <button onClick={handleResetDB} className="px-4 py-2.5 bg-red-900/10 border border-red-800/40 hover:bg-red-900/25 text-red-400 rounded-xl flex items-center gap-2 text-xs font-bold transition-colors" title="Ripristina Default"><Icons.Refresh /> Reset Default</button>
                            <input type="file" accept=".csv" ref={csvFileInputRef} style={{ display: 'none' }} onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) { const r = new FileReader(); r.onload = (ev) => setCsvText(ev.target.result); r.readAsText(file); }
                                e.target.value = '';
                            }} />
                        </div>
                        
                        <textarea 
                            className="flex-1 min-h-[180px] bg-slate-950 border border-slate-850 rounded-xl p-3 text-xs font-mono text-slate-350 focus:border-blue-500 outline-none resize-none custom-scrollbar" 
                            placeholder="Incolla qui il contenuto CSV..." 
                            value={csvText} 
                            onChange={(e) => setCsvText(e.target.value)}
                        ></textarea>
                        
                        <div className="flex justify-end gap-3 mt-5 flex-shrink-0">
                            <button onClick={() => setShowImport(false)} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-850 text-sm font-semibold transition-colors">Annulla</button>
                            <button onClick={handleImportCSV} className="px-5 py-2 bg-blue-650 hover:bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-900/30"><Icons.Check /> Applica CSV</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CHARACTER EDITOR VIEW */}
            {view === 'editor' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* EDITOR HEADER */}
                    <header className="bg-slate-900 border-b border-slate-850 p-4 shadow-lg z-10 flex-shrink-0">
                        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-8">
                            
                            {/* Left part: back button and char header */}
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => { setView('lobby'); showToast("Ritornato alla libreria", 'info'); }}
                                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-750 transition-all"
                                    title="Torna alla Libreria"
                                >
                                    <Icons.ArrowLeft />
                                </button>
                                
                                <div className="h-8 w-px bg-slate-850"></div>
                                
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <h2 className="text-lg font-bold text-white tracking-tight">{currentProfile}</h2>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-855 text-slate-400 border border-slate-800">
                                            Livello {charData.charPower?.level || 1}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> 
                                        Salvataggio automatico attivo
                                    </p>
                                </div>
                            </div>

                            {/* Middle part: CP tracker */}
                            <div className="flex items-center gap-4 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-850/80">
                                <div className={`flex flex-col px-3 py-0.5 transition-colors duration-300`}>
                                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none">CP spesi</span>
                                    <span className={`text-lg font-mono font-black mt-1 leading-none ${totalCPSpent > totalCPAvailable ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                                        {totalCPSpent} <span className="text-slate-650 text-sm font-normal">/</span> {totalCPAvailable}
                                    </span>
                                </div>
                                <div className="h-6 w-px bg-slate-800"></div>
                                {/* Bar indicator */}
                                <div className="w-24 sm:w-32 flex flex-col gap-1.5 pr-2">
                                    <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-850">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-300 ${totalCPSpent > totalCPAvailable ? 'bg-red-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${Math.min(100, (totalCPSpent / totalCPAvailable) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Right part: Export / quick menu */}
                            <div className="flex gap-2 items-center flex-wrap">
                                <button onClick={handleExportSummary} className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-purple-250 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-750 transition-all" title="Esporta riepilogo testuale (TXT)">
                                    <Icons.FileText /> Esporta TXT
                                </button>
                                <button onClick={() => handleDownloadSave(true)} className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 hover:text-blue-250 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-750 transition-all" title="Esporta salvataggio JSON">
                                    <Icons.Download /> Esporta JSON
                                </button>
                                <button 
                                    onClick={handleSendToMasterClick} 
                                    disabled={isSubmittingToMaster}
                                    className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 border transition-all shadow-md ${
                                        isSubmittingToMaster 
                                            ? 'bg-amber-600/20 border-amber-500/30 text-amber-300/50 cursor-not-allowed' 
                                            : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 text-amber-300 hover:text-amber-200 hover:border-amber-400 active:scale-95 shadow-amber-950/20'
                                    }`}
                                    title={charData.meta?.playerName ? `Invia scheda al Drive del Master (Giocatore: ${charData.meta.playerName}) - Shift+Click per modificare nome` : "Invia la scheda al Google Drive e Sheets del Master"}
                                >
                                    {isSubmittingToMaster ? (
                                        <>
                                            <Icons.Loader />
                                            <span>Invio in corso...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Icons.Send />
                                            <span>Invia al Master</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Search and Filters if activeTab is features */}
                        {activeTab === 'features' && (
                            <div className="w-full flex flex-col sm:flex-row gap-3 items-center mt-4 pt-3 border-t border-slate-855 animate-in slide-in-from-top-1 duration-200 px-4 md:px-8">
                                <div className="relative flex-1 w-full">
                                    <div className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-500"><Icons.Search /></div>
                                    <input 
                                        type="text" 
                                        placeholder={`Cerca tra ${db.length} Class Features...`} 
                                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:border-blue-500 transition-colors text-xs" 
                                        value={search} 
                                        onChange={(e) => setSearch(e.target.value)} 
                                    />
                                    {search && (
                                        <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-white">
                                            <Icons.X />
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1 items-center custom-scrollbar">
                                    <button 
                                        onClick={() => setShowSelectedOnly(!showSelectedOnly)} 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border flex items-center gap-1.5 ${showSelectedOnly ? 'bg-emerald-600/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-950 text-slate-500 border-slate-850 hover:bg-slate-850'}`}
                                    >
                                        <Icons.Check /> Selezionati ({(charData.features || []).length})
                                    </button>
                                    <div className="w-px h-6 bg-slate-800"></div>
                                    <button 
                                        onClick={() => setSelectedClassFilter("all")} 
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${(!selectedClassFilter || selectedClassFilter === 'all') ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-slate-950 text-slate-500 border-slate-850 hover:bg-slate-850'}`}
                                    >
                                        Tutte le classi
                                    </button>
                                    {FIXED_CLASSES_LIST.map(cls => {
                                        const isActive = selectedClassFilter && selectedClassFilter.toLowerCase() === cls.toLowerCase();
                                        return (
                                            <button 
                                                key={cls} 
                                                onClick={() => setSelectedClassFilter(current => (current && current.toLowerCase() === cls.toLowerCase()) ? "all" : cls)} 
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border flex items-center gap-1.5 ${isActive ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-slate-950 text-slate-500 border-slate-850 hover:bg-slate-850'}`}
                                            >
                                                {cls}
                                                {isActive && <Icons.X />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </header>

                    {/* VISTA TAB 1: BASIC FEATURES (STATS, CLASSES, HP, FEATS, SKILLS) */}
                    {activeTab === 'basic' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                            <div className="w-full flex flex-col lg:flex-row gap-6 px-4 md:px-8">
                                
                                {/* COLONNA SINISTRA (1/3) - STATS, CLASSES & HP */}
                                <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col gap-6">
                                    
                                    {/* CARD 1: STAT GENERATOR */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <h3 className="text-md font-bold text-blue-400 mb-4 flex items-center gap-2">
                                            <Icons.Chart /> Generatore Statistiche
                                        </h3>
                                        <div className="overflow-x-auto custom-scrollbar">
                                            <table className="w-full text-left border-collapse min-w-[280px]">
                                                <thead>
                                                    <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-850 font-black tracking-wider">
                                                        <th className="pb-2 w-12">Stat</th>
                                                        <th className="pb-2 w-20">Base</th>
                                                        <th className="pb-2 text-center">Costo</th>
                                                        <th className="pb-2 text-center w-8">Rnd</th>
                                                        <th className="pb-2 text-center w-8">Tlt</th>
                                                        <th className="pb-2 text-center w-8">Aum</th>
                                                        <th className="pb-2 text-center w-8">Msc</th>
                                                        <th className="pb-2 text-right text-white">Tot</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-xs divide-y divide-slate-850/60">
                                                    {Object.keys(charData.stats || DEFAULT_STATS).map(key => {
                                                        const statObj = charData.stats?.[key] || { base: 8, race: 0, feat: 0, ability: 0, misc: 0 };
                                                        return (
                                                            <tr key={key} className="hover:bg-slate-850/20">
                                                                <td className="py-2.5 font-bold text-blue-400">{key}</td>
                                                                <td className="py-2.5">
                                                                    <select 
                                                                        value={statObj.base ?? 8} 
                                                                        onChange={(e) => handleStatChange(key, 'base', e.target.value)}
                                                                        className="bg-slate-950 border border-slate-850 rounded-lg px-2 py-1 text-white font-semibold focus:border-blue-500 outline-none w-16"
                                                                    >
                                                                        {[8,9,10,11,12,13,14,15].map(v => <option key={v} value={v}>{v}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td className="py-2.5 text-center font-mono font-bold text-slate-500">
                                                                    {POINT_BUY_COSTS[statObj.base] || 0}
                                                                </td>
                                                                <td className="py-2.5 text-center"><input type="number" className="w-8 bg-transparent border-b border-slate-800 text-center font-mono focus:border-blue-500 outline-none" value={statObj.race || ''} onChange={(e) => handleStatChange(key, 'race', e.target.value)} /></td>
                                                                <td className="py-2.5 text-center"><input type="number" className="w-8 bg-transparent border-b border-slate-800 text-center font-mono focus:border-blue-500 outline-none" value={statObj.feat || ''} onChange={(e) => handleStatChange(key, 'feat', e.target.value)} /></td>
                                                                <td className="py-2.5 text-center"><input type="number" className="w-8 bg-transparent border-b border-slate-800 text-center font-mono focus:border-blue-500 outline-none" value={statObj.ability || ''} onChange={(e) => handleStatChange(key, 'ability', e.target.value)} /></td>
                                                                <td className="py-2.5 text-center"><input type="number" className="w-8 bg-transparent border-b border-slate-800 text-center font-mono focus:border-blue-500 outline-none" value={statObj.misc || ''} onChange={(e) => handleStatChange(key, 'misc', e.target.value)} /></td>
                                                                <td className="py-2.5 text-right font-black text-white text-sm">{calculateFinalScore(statObj)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="border-t border-slate-850 font-bold text-[10px]">
                                                        <td className="pt-3 uppercase text-slate-500">Point Buy</td>
                                                        <td className="pt-3"></td>
                                                        <td className={`pt-3 text-center font-mono font-black text-xs ${bpUsed > 27 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                                                            {bpUsed} / 27
                                                        </td>
                                                        <td className="pt-3" colSpan="3"></td>
                                                        <td className="pt-3 text-right uppercase text-slate-500">Costo CP</td>
                                                        <td className="pt-3 text-right font-mono font-bold text-yellow-500 text-xs">
                                                            {abilityCostCP} CP
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>

                                    {/* CARD 2: POWER & CLASS */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <h3 className="text-md font-bold text-blue-400 mb-4 flex items-center gap-2">
                                            <Icons.Zap /> Livello & Classe
                                        </h3>
                                        
                                        {/* Power level parameters */}
                                        <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850/50 mb-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Livello Personaggio</span>
                                                    <select 
                                                        value={charData.charPower?.level || 1} 
                                                        onChange={(e) => handleCharPowerChange('level', parseInt(e.target.value))}
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-bold focus:border-blue-500 outline-none text-xs"
                                                    >
                                                        {Array.from({length: 40}, (_, i) => i + 1).map(lvl => (
                                                            <option key={lvl} value={lvl}>Lv. {lvl}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Punti Creazione/Lv</span>
                                                    <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg p-1">
                                                        <button 
                                                            onClick={() => handleCharPowerChange('cpPerLevel', Math.max(0, (charData.charPower?.cpPerLevel || 0) - 0.5))}
                                                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors text-xs"
                                                        >-</button>
                                                        <input 
                                                            type="number" 
                                                            step="0.5"
                                                            value={charData.charPower?.cpPerLevel || 0} 
                                                            onChange={(e) => handleCharPowerChange('cpPerLevel', parseFloat(e.target.value) || 0)}
                                                            className="w-10 bg-transparent text-center text-white font-bold outline-none text-xs font-mono"
                                                        />
                                                        <button 
                                                            onClick={() => handleCharPowerChange('cpPerLevel', (charData.charPower?.cpPerLevel || 0) + 0.5)}
                                                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors text-xs"
                                                        >+</button>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-850/60 text-xs">
                                                <span className="font-bold text-slate-400">Punti Creazione Disponibili</span>
                                                <span className="font-mono font-bold text-emerald-400 text-sm">{totalCPAvailable} CP</span>
                                            </div>
                                        </div>

                                        {/* Classes list */}
                                        <div className="space-y-3">
                                            {(charData.classes || []).map((clsItem, index) => {
                                                const profData = proficiencyMap[clsItem.className];
                                                const req = CLASS_REQUIREMENTS[clsItem.className];
                                                const currentStatValues = {
                                                    STR: calculateFinalScore(charData.stats?.STR),
                                                    DEX: calculateFinalScore(charData.stats?.DEX),
                                                    CON: calculateFinalScore(charData.stats?.CON),
                                                    INT: calculateFinalScore(charData.stats?.INT),
                                                    WIS: calculateFinalScore(charData.stats?.WIS),
                                                    CHA: calculateFinalScore(charData.stats?.CHA)
                                                };
                                                const checkFn = req ? (req.check || (typeof parseClassRequirement === 'function' ? parseClassRequirement(req.text) : () => true)) : () => true;
                                                const isReqMet = checkFn(currentStatValues);

                                                return (
                                                    <div key={index} className="bg-slate-950/45 p-3 rounded-xl border border-slate-850">
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <div className="flex-1 min-w-[120px]">
                                                                <select
                                                                    value={clsItem.className}
                                                                    onChange={(e) => updateClass(index, 'className', e.target.value)}
                                                                    className="bg-transparent text-white w-full focus:outline-none text-xs font-bold"
                                                                >
                                                                    <option value="" className="bg-slate-900">Seleziona Classe...</option>
                                                                    {FIXED_CLASSES_LIST.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                                                                </select>
                                                                {clsItem.className && req && (
                                                                    <div className={`text-[9px] uppercase font-black tracking-wider mt-1.5 flex items-center gap-1 leading-none ${isReqMet ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                        <span>Prerequisiti: {req.text}</span>
                                                                        <span>{isReqMet ? '✓' : '✕'}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-1.5 bg-slate-950/65 px-2 py-1 rounded-lg border border-slate-850">
                                                                <span className="text-[9px] text-slate-500 font-bold">Liv.</span>
                                                                <select
                                                                    value={clsItem.level}
                                                                    onChange={(e) => updateClass(index, 'level', parseInt(e.target.value))}
                                                                    className="bg-transparent text-white focus:outline-none text-xs font-mono font-bold"
                                                                >
                                                                    {Array.from({length: 40}, (_, i) => i + 1).map(l => <option key={l} value={l} className="bg-slate-900">{l}</option>)}
                                                                </select>
                                                            </div>

                                                            <div className="flex items-center gap-2 ml-auto">
                                                                <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 cursor-pointer select-none">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={clsItem.showProficiency || false} 
                                                                        onChange={() => toggleClassProficiency(index)}
                                                                        className="accent-blue-500 w-3 h-3 rounded"
                                                                    />
                                                                    <span>Prof.</span>
                                                                </label>
                                                                {profData && (
                                                                    <span className={`text-[10px] font-mono font-bold ${clsItem.showProficiency ? 'text-yellow-500' : 'text-slate-650'}`}>
                                                                        ({profData.cost} CP)
                                                                    </span>
                                                                )}
                                                                <button onClick={() => removeClass(index)} className="text-slate-600 hover:text-red-400 p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
                                                                    <Icons.Trash />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Proficiency info box */}
                                                        {clsItem.showProficiency && profData && (
                                                            <div className="mt-2.5 p-2 bg-slate-900/60 rounded-lg border border-slate-800 text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed animate-in slide-in-from-top-1">
                                                                {profData.desc}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            <button
                                                onClick={addClass}
                                                className="w-full py-2.5 border-2 border-dashed border-slate-800 text-slate-550 rounded-xl hover:border-blue-500 hover:text-blue-400 hover:bg-slate-900/30 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                                            >
                                                <Icons.Plus /> Aggiungi Classe
                                            </button>
                                        </div>
                                    </div>

                                    {/* CARD 3: HIT POINTS */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <h3 className="text-md font-bold text-red-400 mb-4 flex items-center gap-2">
                                            <Icons.Heart /> Punti Ferita (HP)
                                        </h3>
                                        {hpClassesForDisplay.length === 0 ? (
                                            <div className="text-center py-6 text-slate-600 text-xs italic border border-dashed border-slate-850 rounded-xl">Seleziona una classe ed abilita la Proficienza per gestire gli HP.</div>
                                        ) : (
                                            <div className="space-y-4">
                                                {hpClassesForDisplay.map((cls, idx) => {
                                                    const baseHp = getHpPerLevel(cls.className);
                                                    const currentHp = cls.selectedHp || baseHp;
                                                    const upgradeCost = calculateSingleHpCost(baseHp, currentHp);
                                                    const realIndex = (charData.classes || []).indexOf(cls);

                                                    return (
                                                        <div key={idx} className="bg-slate-950/45 p-3 rounded-xl border border-slate-850 flex flex-col gap-2">
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="font-bold text-slate-300">{cls.className}</span>
                                                                <span className="font-mono text-slate-500 font-semibold">(Lv. {cls.level})</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex-1 flex flex-col gap-1">
                                                                    <span className="text-[9px] font-black text-slate-555 uppercase">HP per Livello</span>
                                                                    <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg p-0.5 max-w-[130px]">
                                                                        <button 
                                                                            onClick={() => updateClassHp(realIndex, Math.max(baseHp, currentHp - 1))}
                                                                            disabled={currentHp <= baseHp}
                                                                            className="w-6 h-6 rounded bg-slate-850 hover:bg-slate-750 disabled:opacity-30 disabled:pointer-events-none text-white font-bold flex items-center justify-center text-xs"
                                                                        >-</button>
                                                                        <span className="font-mono font-bold text-white text-xs">{currentHp}pf</span>
                                                                        <button 
                                                                            onClick={() => updateClassHp(realIndex, currentHp + 1)}
                                                                            className="w-6 h-6 rounded bg-slate-850 hover:bg-slate-750 text-white font-bold flex items-center justify-center text-xs"
                                                                        >+</button>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="text-right">
                                                                    <span className="text-[9px] font-black text-slate-555 uppercase block">Costo HP Extra</span>
                                                                    <span className="font-mono text-xs font-bold text-yellow-500">{upgradeCost} CP</span>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="text-[10px] text-slate-500 mt-1 leading-normal">
                                                                Valore base per livello: <span className="font-bold text-slate-400">{baseHp}pf</span>. I primi 6 livelli costano <span className="text-slate-400 font-semibold">1 CP / hp</span>, i successivi <span className="text-slate-400 font-semibold">2 CP / hp</span>.
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                
                                                <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex justify-between items-center text-xs">
                                                    <div>
                                                        <span className="text-[9px] font-black text-slate-500 block uppercase">Formula HP</span>
                                                        <span className="text-slate-400">({currentHpPerLevel} Classe + {conMod >= 0 ? '+' : ''}{conMod} Cost) * {charData.charPower?.level || 1} Lv</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[9px] font-black text-slate-500 block uppercase">HP Totali</span>
                                                        <span className="text-lg font-black text-red-400 font-mono">{totalHP}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* COLONNA DESTRA (2/3) - FEATS & SKILLS */}
                                <div className="flex-1 w-full flex flex-col gap-6">
                                    
                                    {/* FEATS MANAGEMENT */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
                                            <h3 className="text-md font-bold text-blue-400 flex items-center gap-2">
                                                <Icons.Book /> Talenti (Feats)
                                            </h3>
                                            <div className="bg-slate-950/80 px-3 py-1 rounded-xl text-xs font-mono font-bold text-yellow-500 border border-slate-850">
                                                Costo Talenti: {totalCPFeats} CP
                                            </div>
                                        </div>

                                        {/* Dropdown Selection */}
                                        <div className="flex gap-2 mb-5">
                                            <div className="relative flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center px-3 py-2 text-xs">
                                                <select 
                                                    value={featSelection} 
                                                    onChange={(e) => setFeatSelection(e.target.value)} 
                                                    className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer"
                                                >
                                                    <option value="" className="bg-slate-900">Scegli Talento...</option>
                                                    {availableFeats.map(f => (
                                                        <option key={f.id} value={f.id} className="bg-slate-900">{f.name} ({f.cost} CP)</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"><Icons.Filter /></div>
                                            </div>
                                            <button 
                                                onClick={addFeat} 
                                                disabled={!featSelection} 
                                                className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors ${featSelection ? 'bg-blue-650 hover:bg-blue-600 text-white shadow-md shadow-blue-900/10' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                            >
                                                Aggiungi
                                            </button>
                                        </div>

                                        {/* Feats list */}
                                        <div className="space-y-3">
                                            {(charData.feats || []).map((feat, idx) => (
                                                <div key={`${feat.id}-${idx}`} className="bg-slate-950/45 border border-slate-850 hover:border-slate-800/80 rounded-xl p-4 relative group transition-all">
                                                    <button 
                                                        onClick={() => removeFeat(idx)} 
                                                        className="absolute top-3 right-3 text-slate-650 hover:text-red-400 p-1 rounded-lg hover:bg-slate-900 transition-colors" 
                                                        title="Rimuovi Talento"
                                                    >
                                                        <Icons.Trash />
                                                    </button>
                                                    <div className="flex justify-between items-center pr-8 mb-2">
                                                        <h4 className="font-bold text-white text-sm">{feat.name}</h4>
                                                        <div className="flex items-center gap-3">
                                                            <label className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold cursor-pointer select-none">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={feat.isBonus || false} 
                                                                    onChange={() => toggleBonusFeat(idx)}
                                                                    className="accent-blue-500 w-3 h-3 rounded"
                                                                />
                                                                <span>Talento Bonus</span>
                                                            </label>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${feat.isBonus ? 'bg-slate-900 text-slate-600 line-through border-slate-900' : 'bg-slate-950 text-yellow-500 border-slate-850'}`}>
                                                                {feat.cost} CP
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mb-2 flex gap-3">
                                                        <span className="bg-slate-950/60 px-2 py-0.5 rounded border border-slate-850">Requisito: <span className="text-slate-400">{feat.prereq}</span></span>
                                                        <span className="bg-slate-950/60 px-2 py-0.5 rounded border border-slate-850 flex items-center gap-1"><Icons.Zap /> {feat.action}</span>
                                                    </div>
                                                    <div 
                                                        className="feature-html-desc text-xs text-slate-400 leading-relaxed whitespace-pre-wrap mt-2 pt-2 border-t border-slate-900/60"
                                                        dangerouslySetInnerHTML={{ __html: formatFeatureDesc(feat.desc) }}
                                                    />
                                                </div>
                                            ))}
                                            {(!charData.feats || charData.feats.length === 0) && (
                                                <div className="text-slate-600 text-xs italic text-center py-6 border border-dashed border-slate-850 rounded-xl">Nessun talento selezionato.</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* SKILLS PANEL */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
                                             <div>
                                                <h3 className="text-md font-bold text-blue-400 flex items-center gap-2">
                                                    <Icons.Shield /> Abilità (Skills)
                                                </h3>
                                                <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">1 CP per skill (prima gratis). Le skill di classe (Free) costano 0 CP.</span>
                                             </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <div className="bg-slate-950/80 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold text-yellow-500 border border-slate-850">
                                                    CP Skills: {totalSkillCost} CP
                                                </div>
                                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                                                    Bonus Prof: <span className="text-emerald-400 font-bold">+{getProficiencyBonus(charData.charPower?.level || 1)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="overflow-x-auto custom-scrollbar">
                                            <table className="w-full text-left border-collapse min-w-[480px]">
                                                <thead>
                                                    <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-850 font-black tracking-wider">
                                                        <th className="pb-2 text-center w-12">Prof</th>
                                                        <th className="pb-2">Abilità</th>
                                                        <th className="pb-2 text-center w-14">Stat</th>
                                                        <th className="pb-2 text-center w-14">Classe</th>
                                                        <th className="pb-2 text-center w-14">Maestria</th>
                                                        <th className="pb-2 text-right w-16">Bonus</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-xs divide-y divide-slate-850/60">
                                                    {SKILLS_DATA.map(skill => {
                                                        const state = (charData.skills && charData.skills[skill.name]) || { isProficient: false, isClassSkill: false, isExpert: false };
                                                        const isProficient = state.isProficient;
                                                        const isClassSkill = state.isClassSkill;
                                                        const isExpert = state.isExpert;
                                                        
                                                        const statValue = calculateFinalScore(charData.stats?.[skill.stat]);
                                                        const statMod = getAbilityMod(statValue);
                                                        const pb = getProficiencyBonus(charData.charPower?.level || 1);
                                                        
                                                        const expertMultiplier = isExpert ? 2 : 1;
                                                        const totalBonus = statMod + (isProficient ? pb * expertMultiplier : 0);
                                                        const bonusSign = totalBonus >= 0 ? '+' : '';

                                                        return (
                                                            <tr key={skill.name} className={`hover:bg-slate-850/10 transition-colors ${isProficient ? 'bg-blue-950/10' : ''}`}>
                                                                <td className="py-2 text-center">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isProficient} 
                                                                        onChange={() => toggleSkill(skill.name, 'prof')}
                                                                        className="accent-blue-500 w-3.5 h-3.5 rounded cursor-pointer"
                                                                    />
                                                                </td>
                                                                <td className={`py-2 font-bold ${isProficient ? 'text-white' : 'text-slate-450'}`}>
                                                                    {skill.name}
                                                                </td>
                                                                <td className="py-2 text-center text-[10px] text-slate-500 font-mono">
                                                                    {skill.stat}
                                                                </td>
                                                                <td className="py-2 text-center">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isClassSkill} 
                                                                        disabled={!isProficient}
                                                                        onChange={() => toggleSkill(skill.name, 'class')}
                                                                        className={`w-3.5 h-3.5 rounded cursor-pointer ${!isProficient ? 'opacity-20 cursor-not-allowed' : 'accent-amber-500'}`}
                                                                        title={!isProficient ? "Abilita la competenza prima" : "Rende questa abilità di classe (Costo 0 CP)"}
                                                                    />
                                                                </td>
                                                                <td className="py-2 text-center">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isExpert} 
                                                                        disabled={!isProficient}
                                                                        onChange={() => toggleSkill(skill.name, 'expert')}
                                                                        className={`w-3.5 h-3.5 rounded cursor-pointer ${!isProficient ? 'opacity-20 cursor-not-allowed' : 'accent-purple-500'}`}
                                                                        title={!isProficient ? "Abilita la competenza prima" : "Maestria (Bonus competenza x2)"}
                                                                    />
                                                                </td>
                                                                <td className="py-2 text-right">
                                                                    <span className={`font-black font-mono text-xs ${totalBonus > 0 ? 'text-emerald-450' : totalBonus < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                                        {bonusSign}{totalBonus}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VISTA TAB 2: CLASS FEATURES */}
                    {activeTab === 'features' && (
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <div className="w-full space-y-2 px-4 md:px-8">
                                {/* Table headers */}
                                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-900">
                                    <div className="col-span-1 text-center">Sel</div>
                                    <div className="col-span-3">Feature Name</div>
                                    <div className="col-span-2">Classe / Tag</div>
                                    <div className="col-span-1 text-center">CP</div>
                                    <div className="col-span-1 text-center">Richiede</div>
                                    <div className="col-span-1 text-center">Azione</div>
                                    <div className="col-span-3 text-left">Prerequisiti</div>
                                </div>

                                {/* Features list */}
                                {visibleFeatures.map((feat, idx) => {
                                    const isSelected = isFeatureSelected(feat, charData.features, dbMap);
                                    const displayTags = feat.tag ? feat.tag.split(';').map(t => t.trim()) : [];
                                    const displayPrereqs = feat.pre && feat.pre !== '-' ? feat.pre.split(';').map(t => t.trim()).filter(Boolean) : [];
                                    
                                    let canSelect = true;
                                    let reqMsg = '';
                                    if (!isSelected && displayPrereqs.length > 0) {
                                        const unmet = displayPrereqs.filter(p => !checkPrereq(p));
                                        if (unmet.length > 0) { canSelect = false; reqMsg = `Manca: ${unmet.join(', ')}`; }
                                    }
                                    if (canSelect && !isSelected) {
                                        const classCheck = checkClassPrereq(feat);
                                        if (!classCheck.allowed) { canSelect = false; reqMsg = classCheck.msg; }
                                    }

                                    return (
                                        <div 
                                            key={`${feat.id || feat.name}_${feat.tag}_${feat.req}_${idx}`} 
                                            onClick={() => toggleFeature(feat.id || feat.name)}
                                            title={!canSelect && !isSelected ? reqMsg : ''}
                                            className={`group relative rounded-xl border transition-all duration-200 overflow-hidden ${isSelected ? 'bg-blue-900/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.05)] cursor-pointer' : canSelect ? 'bg-slate-900 border-slate-850 hover:bg-slate-850 hover:border-slate-750 cursor-pointer' : 'bg-slate-900/40 border-slate-900/50 opacity-40 cursor-not-allowed grayscale'}`}
                                        >
                                            <div className="p-3.5 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center">
                                                {/* Select button */}
                                                <div className="flex justify-between items-center sm:col-span-1 sm:justify-center mb-2 sm:mb-0">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : canSelect ? 'border-slate-700 bg-slate-950 group-hover:border-slate-500' : 'border-slate-850 bg-slate-900'}`}>
                                                        {isSelected ? <Icons.Check /> : !canSelect && <Icons.Lock />}
                                                    </div>
                                                    <span className="sm:hidden text-[10px] font-bold text-slate-500 uppercase">{feat.tag}</span>
                                                </div>

                                                {/* Name & Desc */}
                                                <div className="sm:col-span-3 mb-2 sm:mb-0">
                                                    <div className={`font-bold text-sm ${isSelected ? 'text-blue-200' : 'text-white'}`}>{feat.name}</div>
                                                    {!canSelect && !isSelected && <div className="text-[9px] text-red-500 font-bold mt-1 uppercase">{reqMsg}</div>}
                                                    {feat.pre && feat.pre !== '-' && (
                                                        <div className="sm:hidden mt-1 flex flex-wrap gap-1">
                                                            {displayPrereqs.map((p, i) => (
                                                                <span key={i} className={`text-[9px] px-1.5 py-0.2 bg-slate-950 rounded border ${checkPrereq(p) ? 'text-emerald-400 border-emerald-950' : 'text-red-400 border-red-950'}`}>
                                                                    {p} {checkPrereq(p) ? '✓' : '✕'}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Tags */}
                                                <div className="hidden sm:block sm:col-span-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {displayTags.map((t, i) => (
                                                            <span key={i} className="px-2 py-0.5 rounded text-[9px] uppercase font-black bg-slate-950 text-slate-450 border border-slate-850">{t}</span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Details */}
                                                <div className="flex justify-between items-center sm:contents text-xs">
                                                    <div className="sm:col-span-1 sm:text-center flex flex-col sm:block items-center"><span className="sm:hidden text-[9px] text-slate-500 font-bold uppercase mb-0.5">Costo CP</span><span className="font-mono font-bold text-yellow-500">{feat.cp} CP</span></div>
                                                    <div className="sm:col-span-1 sm:text-center flex flex-col sm:block items-center"><span className="sm:hidden text-[9px] text-slate-500 font-bold uppercase mb-0.5">Liv.</span><span className="font-mono text-slate-400 font-semibold">{feat.req}</span></div>
                                                    <div className="sm:col-span-1 sm:text-center flex flex-col sm:block items-center"><span className="sm:hidden text-[9px] text-slate-500 font-bold uppercase mb-0.5">Azione</span><span className="font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-850 text-[10px] truncate max-w-[65px]" title={feat.ap}>{feat.ap}</span></div>
                                                    <div className="hidden sm:block sm:col-span-3 text-[10px]">
                                                        {displayPrereqs.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {displayPrereqs.map((p, i) => (
                                                                    <span key={i} className={`px-1.5 py-0.5 rounded border font-semibold ${checkPrereq(p) ? 'text-emerald-450 bg-emerald-950/10 border-emerald-950' : 'text-red-400 bg-red-950/10 border-red-950'}`}>
                                                                        {p} {checkPrereq(p) ? '✓' : '✕'}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : '-'}
                                                    </div>
                                                </div>

                                                {/* Expanded Description */}
                                                <div 
                                                    className="feature-html-desc text-xs col-span-12 overflow-x-auto transition-all duration-300 mt-2.5 pt-2.5 border-t border-slate-850/60 text-slate-400 leading-relaxed whitespace-pre-wrap"
                                                    onClick={(e) => {
                                                        if (e.target.closest('table') || e.target.closest('.table-container') || e.target.closest('th') || e.target.closest('td')) {
                                                            e.stopPropagation();
                                                        }
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: formatFeatureDesc(feat.desc) }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* VISTA TAB 3: COMBAT & MAGIC */}
                    {activeTab === 'combat_magic' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                            <div className="w-full flex flex-col lg:flex-row gap-6 px-4 md:px-8">
                                
                                {/* COLONNA SINISTRA (1/3) - COMBAT STUFF */}
                                <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col gap-6">
                                    
                                    {/* FIGHTING STYLES */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
                                            <h3 className="text-md font-bold text-blue-400 flex items-center gap-2">
                                                <span className="bg-blue-500 w-1 h-5 rounded-full"></span> Fighting Styles
                                            </h3>
                                            <div className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-lg text-yellow-500">
                                                {(charData.fightingStyles || []).length * 3} CP
                                            </div>
                                        </div>
                                        
                                        {/* Dropdown Selection */}
                                        <div className="flex gap-2 mb-4">
                                            <div className="relative flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center px-3 py-2 text-xs">
                                                <select 
                                                    value={fightingStyleSelection} 
                                                    onChange={(e) => setFightingStyleSelection(e.target.value)} 
                                                    className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer" 
                                                >
                                                    <option value="" className="bg-slate-900">Seleziona Stile...</option>
                                                    {availableFightingStyles.map(s => (
                                                        <option key={s.id} value={s.id} className="bg-slate-900">{s.name} (3 CP)</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"><Icons.Filter /></div>
                                            </div>
                                            <button onClick={addFightingStyle} disabled={!fightingStyleSelection} className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors ${fightingStyleSelection ? 'bg-blue-650 text-white hover:bg-blue-600' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} >
                                                Aggiungi
                                            </button>
                                        </div>
                                        
                                        {/* Styles List */}
                                        <div className="space-y-3">
                                            {(charData.fightingStyles || []).map((style, idx) => (
                                                <div key={`${style.id}-${idx}`} className="bg-slate-950/45 border border-slate-850 rounded-xl p-3.5 relative group hover:border-slate-800 transition-all">
                                                    <button onClick={() => removeFightingStyle(style.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors" title="Rimuovi Stile"><Icons.Trash /></button>
                                                    <div className="flex justify-between items-center pr-6 mb-1.5">
                                                        <div className="font-bold text-xs text-white">{style.name}</div>
                                                        {style.action && style.action !== 'None' && <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-850 uppercase font-black">{style.action}</span>}
                                                    </div>
                                                    <div className="text-[10px] text-yellow-600 font-bold mb-2">Costo: 3 CP</div>
                                                    <div className="feature-html-desc text-xs text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatFeatureDesc(style.desc) }} />
                                                </div>
                                            ))}
                                            {(!charData.fightingStyles || charData.fightingStyles.length === 0) && <div className="text-slate-600 text-xs italic text-center py-4 border border-dashed border-slate-850 rounded-xl">Nessuno stile selezionato.</div>}
                                        </div>
                                    </div>

                                    {/* MARTIAL ADEPT */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
                                            <h3 className="text-md font-bold text-blue-400 flex items-center gap-2">
                                                <span className="bg-red-500 w-1 h-5 rounded-full"></span> Martial Adept
                                            </h3>
                                            <div className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-lg text-yellow-500">
                                                {totalCPMartialAdept} CP
                                            </div>
                                        </div>
                                        
                                        {/* Dropdown Selection */}
                                        <div className="flex gap-2 mb-4">
                                            <div className="relative flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center px-3 py-2 text-xs">
                                                <select value={maneuverSelection} onChange={(e) => setManeuverSelection(e.target.value)} 
                                                    className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer" >
                                                    <option value="" className="bg-slate-900">Seleziona Manovra...</option>
                                                    {availableManeuvers.map(s => (
                                                        <option key={s.id} value={s.id} className="bg-slate-900">{s.name} (3 CP)</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"><Icons.Filter /></div>
                                            </div>
                                            <button onClick={addManeuver} disabled={!maneuverSelection} className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors ${maneuverSelection ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} >
                                                Aggiungi
                                            </button>
                                        </div>
                                        
                                        {/* Maneuvers list */}
                                        <div className="space-y-3">
                                            {(charData.maneuvers || []).map((item, idx) => {
                                                const m = typeof item === 'object' ? item : (maneuversMap[item] || (maneuversDb || []).find(x => x.id === item));
                                                const isFighter = typeof item === 'object' ? item.isFighter : false;
                                                const itemId = m ? m.id : idx;
                                                
                                                if (!m) return null;

                                                return (
                                                    <div key={`${itemId}-${idx}`} className={`bg-slate-950/45 border rounded-xl p-3.5 relative group transition-all ${isFighter ? 'border-red-500/30 bg-red-950/5' : 'border-slate-850 hover:border-slate-800'}`}>
                                                        <button onClick={() => removeManeuver(itemId)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors" title="Rimuovi Manovra"><Icons.Trash /></button>
                                                        <div className="flex justify-between items-center pr-6 mb-1.5">
                                                            <div className="font-bold text-xs text-white">{m.name}</div>
                                                            {m.action && m.action !== 'None' && m.action !== '-' && <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-850 font-black">{m.action}</span>}
                                                        </div>
                                                        
                                                        <div className="flex items-center justify-between mb-3 mt-2 bg-slate-950/80 p-2 rounded-lg border border-slate-850/65">
                                                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-bold text-slate-400">
                                                                <input type="checkbox" checked={isFighter} onChange={() => toggleFighterManeuver(itemId)} className="accent-red-500 w-3 h-3 rounded" />
                                                                <span>Abilità Fighter (Gratis)</span>
                                                            </label>
                                                            <div className={`text-[10px] font-mono font-black ${isFighter ? 'text-slate-600 line-through' : 'text-yellow-500'}`}>
                                                                {isFighter ? '0 CP' : '3 CP'}
                                                            </div>
                                                        </div>
                                                        <div className="feature-html-desc text-xs text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatFeatureDesc(m.desc) }} />
                                                    </div>
                                                );
                                            })}
                                            {(!charData.maneuvers || charData.maneuvers.length === 0) && <div className="text-slate-600 text-xs italic text-center py-4 border border-dashed border-slate-850 rounded-xl">Nessuna manovra selezionata.</div>}
                                        </div>
                                    </div>

                                    {/* CUNNING STRIKE */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
                                            <h3 className="text-md font-bold text-blue-400 flex items-center gap-2">
                                                <span className="bg-amber-500 w-1 h-5 rounded-full"></span> Cunning Strikes
                                            </h3>
                                            <div className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-lg text-yellow-500">
                                                {(charData.cunningStrikes || []).length * 2} CP
                                            </div>
                                        </div>
                                        
                                        {/* Dropdown Selection */}
                                        <div className="flex gap-2 mb-4">
                                            <div className="relative flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center px-3 py-2 text-xs">
                                                <select value={cunningStrikeSelection} onChange={(e) => setCunningStrikeSelection(e.target.value)} 
                                                    className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer" >
                                                    <option value="" className="bg-slate-900">Seleziona Strike...</option>
                                                    {availableCunningStrikes.map(s => (
                                                        <option key={s.id} value={s.id} className="bg-slate-900">{s.name} (2 CP)</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"><Icons.Filter /></div>
                                            </div>
                                            <button onClick={addCunningStrike} disabled={!cunningStrikeSelection} className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors ${cunningStrikeSelection ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} >
                                                Aggiungi
                                            </button>
                                        </div>
                                        
                                        {/* Striking List */}
                                        <div className="space-y-3">
                                            {(charData.cunningStrikes || []).map((strike, idx) => (
                                                <div key={`${strike.id}-${idx}`} className="bg-slate-950/45 border border-slate-850 rounded-xl p-3.5 relative group hover:border-slate-800 transition-all">
                                                    <button onClick={() => removeCunningStrike(strike.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors" title="Rimuovi Strike"><Icons.Trash /></button>
                                                    <div className="flex justify-between items-center pr-6 mb-1.5">
                                                        <div className="font-bold text-xs text-white">{strike.name}</div>
                                                        {strike.costDice && strike.costDice !== '-' && <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-850 font-black">Dice Cost: {strike.costDice}</span>}
                                                    </div>
                                                    <div className="text-[10px] text-yellow-600 font-bold mb-2">Costo: 2 CP</div>
                                                    <div className="feature-html-desc text-xs text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatFeatureDesc(strike.desc) }} />
                                                </div>
                                            ))}
                                            {(!charData.cunningStrikes || charData.cunningStrikes.length === 0) && <div className="text-slate-600 text-xs italic text-center py-4 border border-dashed border-slate-850 rounded-xl">Nessun Cunning Strike selezionato.</div>}
                                        </div>
                                    </div>

                                    {/* METAMAGIC ADEPT */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
                                            <h3 className="text-md font-bold text-blue-400 flex items-center gap-2">
                                                <span className="bg-purple-500 w-1 h-5 rounded-full"></span> Metamagic Adept
                                            </h3>
                                            <div className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-lg text-yellow-500">
                                                {totalCPMetamagic} CP
                                            </div>
                                        </div>
                                        
                                        {/* Dropdown Selection */}
                                        <div className="flex gap-2 mb-4">
                                            <div className="relative flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center px-3 py-2 text-xs">
                                                <select value={metamagicSelection} onChange={(e) => setMetamagicSelection(e.target.value)} 
                                                    className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer" >
                                                    <option value="" className="bg-slate-900">Seleziona Metamagic...</option>
                                                    {availableMetamagic.map(s => (
                                                        <option key={s.id} value={s.id} className="bg-slate-900">{s.name} (2 CP)</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"><Icons.Filter /></div>
                                            </div>
                                            <button onClick={addMetamagic} disabled={!metamagicSelection} className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors ${metamagicSelection ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} >
                                                Aggiungi
                                            </button>
                                        </div>
                                        
                                        {/* Metamagic list */}
                                        <div className="space-y-3">
                                            {(charData.metamagic || []).map((item, idx) => {
                                                const mm = typeof item === 'object' ? item : metamagicDb.find(m => m.id === item);
                                                const isSorcerer = typeof item === 'object' ? item.isSorcerer : false;
                                                const itemId = mm ? mm.id : idx;
                                                
                                                if (!mm) return null;

                                                return (
                                                    <div key={`${itemId}-${idx}`} className={`bg-slate-950/45 border rounded-xl p-3.5 relative group transition-all ${isSorcerer ? 'border-purple-500/30 bg-purple-950/5' : 'border-slate-850 hover:border-slate-800'}`}>
                                                        <button onClick={() => removeMetamagic(itemId)} className="absolute top-2 right-2 text-slate-655 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors" title="Rimuovi Metamagic"><Icons.Trash /></button>
                                                        <div className="flex justify-between items-center pr-6 mb-1.5">
                                                            <div className="font-bold text-xs text-white">{mm.name}</div>
                                                            {mm.spCost && mm.spCost !== '-' && <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-850 font-black">SP: {mm.spCost}</span>}
                                                        </div>
                                                        
                                                        <div className="flex items-center justify-between mb-3 mt-2 bg-slate-950/80 p-2 rounded-lg border border-slate-850/65">
                                                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-bold text-slate-450">
                                                                <input type="checkbox" checked={isSorcerer} onChange={() => toggleSorcererMetamagic(itemId)} className="accent-purple-500 w-3 h-3 rounded" />
                                                                <span>Abilità Stregone (Gratis)</span>
                                                            </label>
                                                            <div className={`text-[10px] font-mono font-black ${isSorcerer ? 'text-slate-600 line-through' : 'text-yellow-500'}`}>
                                                                {isSorcerer ? '0 CP' : '2 CP'}
                                                            </div>
                                                        </div>
                                                        <div className="feature-html-desc text-xs text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatFeatureDesc(mm.desc) }} />
                                                    </div>
                                                );
                                            })}
                                            {(!charData.metamagic || charData.metamagic.length === 0) && <div className="text-slate-600 text-xs italic text-center py-4 border border-dashed border-slate-850 rounded-xl">Nessuna opzione Metamagic selezionata.</div>}
                                        </div>
                                    </div>

                                    {/* ELDRITCH ADEPT */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
                                            <h3 className="text-md font-bold text-blue-400 flex items-center gap-2">
                                                <span className="bg-emerald-500 w-1 h-5 rounded-full"></span> Eldritch Adept
                                            </h3>
                                            <div className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-lg text-yellow-500">
                                                {totalCPEldritchAdept} CP
                                            </div>
                                        </div>
                                        
                                        {/* Dropdown Selection */}
                                        <div className="flex gap-2 mb-4">
                                            <div className="relative flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center px-3 py-2 text-xs">
                                                <select value={invocationSelection} onChange={(e) => setInvocationSelection(e.target.value)} 
                                                    className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer" >
                                                    <option value="" className="bg-slate-900">Seleziona Invocazione...</option>
                                                    {availableInvocations.map(s => (
                                                        <option key={s.id} value={s.id} className="bg-slate-900">{s.name} (3 CP)</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"><Icons.Filter /></div>
                                            </div>
                                            <button onClick={addInvocation} disabled={!invocationSelection} className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors ${invocationSelection ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} >
                                                Aggiungi
                                            </button>
                                        </div>
                                        
                                        {/* Invocations list */}
                                        <div className="space-y-3">
                                            {(charData.invocations || []).map((item, idx) => {
                                                const inv = typeof item === 'object' ? item : (invocationsMap[item] || (invocationsDb || []).find(x => x.id === item));
                                                const isWarlock = typeof item === 'object' ? item.isWarlock : false;
                                                const itemId = inv ? inv.id : idx;
                                                
                                                if (!inv) return null;

                                                return (
                                                    <div key={`${itemId}-${idx}`} className={`bg-slate-950/45 border rounded-xl p-3.5 relative group transition-all ${isWarlock ? 'border-emerald-500/30 bg-emerald-950/5' : 'border-slate-850 hover:border-slate-800'}`}>
                                                        <button onClick={() => removeInvocation(itemId)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors" title="Rimuovi Invocazione"><Icons.Trash /></button>
                                                        <div className="flex justify-between items-center pr-6 mb-1.5">
                                                            <div className="font-bold text-xs text-white">{inv.name}</div>
                                                            {inv.action && inv.action !== 'None' && inv.action !== '-' && <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-850 font-black">{inv.action}</span>}
                                                        </div>
                                                        
                                                        <div className="flex items-center justify-between mb-3 mt-2 bg-slate-950/80 p-2 rounded-lg border border-slate-850/65">
                                                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-bold text-slate-400">
                                                                <input type="checkbox" checked={isWarlock} onChange={() => toggleWarlockInvocation(itemId)} className="accent-emerald-500 w-3 h-3 rounded" />
                                                                <span>Abilità Warlock (Gratis)</span>
                                                            </label>
                                                            <div className={`text-[10px] font-mono font-black ${isWarlock ? 'text-slate-600 line-through' : 'text-yellow-500'}`}>
                                                                {isWarlock ? '0 CP' : '3 CP'}
                                                            </div>
                                                        </div>
                                                        <div className="feature-html-desc text-xs text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatFeatureDesc(inv.desc) }} />
                                                    </div>
                                                );
                                            })}
                                            {(!charData.invocations || charData.invocations.length === 0) && <div className="text-slate-600 text-xs italic text-center py-4 border border-dashed border-slate-850 rounded-xl">Nessuna invocazione selezionata.</div>}
                                        </div>
                                    </div>
                                </div>

                                {/* COLONNA DESTRA (2/3) - SPELLCASTING & MAGIC PARAMS */}
                                <div className="flex-1 w-full flex flex-col gap-6">
                                    
                                    {/* MAGIC CORE PARAMETERS */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <h3 className="text-md font-bold text-blue-400 mb-4 flex items-center gap-2">
                                            <Icons.Sliders /> Parametri Magia Generici
                                        </h3>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Extra Spell Known */}
                                            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Extra Incantesimi Conosciuti</span>
                                                <div className="flex items-center gap-2.5">
                                                     <button onClick={() => handleMagicChange('extraSpells', Math.max(0, (charData.magic?.extraSpells || 0) - 1))} className="w-7 h-7 rounded-lg bg-slate-850 hover:bg-slate-750 text-white font-bold flex items-center justify-center">-</button>
                                                     <span className="text-xl font-mono font-black text-white w-8">{charData.magic?.extraSpells || 0}</span>
                                                     <button onClick={() => handleMagicChange('extraSpells', (charData.magic?.extraSpells || 0) + 1)} className="w-7 h-7 rounded-lg bg-slate-850 hover:bg-slate-750 text-white font-bold flex items-center justify-center">+</button>
                                                </div>
                                                <span className="text-[9px] text-yellow-500 mt-3 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-850 font-bold">Costo: {charData.magic?.extraSpells || 0} CP</span>
                                            </div>

                                            {/* Extra Spell Slot */}
                                            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Slot Extra per Livello</span>
                                                <div className="flex items-center gap-2.5">
                                                     <button onClick={() => handleMagicChange('extraSlots', Math.max(0, (charData.magic?.extraSlots || 0) - 1))} className="w-7 h-7 rounded-lg bg-slate-850 hover:bg-slate-750 text-white font-bold flex items-center justify-center" disabled={(charData.magic?.extraSlots || 0) <= 0}>-</button>
                                                     <span className="text-xl font-mono font-black text-white w-8">{charData.magic?.extraSlots || 0}</span>
                                                     <button onClick={() => handleMagicChange('extraSlots', Math.min(3, (charData.magic?.extraSlots || 0) + 1))} className="w-7 h-7 rounded-lg bg-slate-850 hover:bg-slate-750 text-white font-bold flex items-center justify-center" disabled={(charData.magic?.extraSlots || 0) >= 3}>+</button>
                                                </div>
                                                <span className="text-[9px] text-yellow-500 mt-3 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-850 font-bold">Costo: {(charData.magic?.extraSlots || 0) * 10} CP</span>
                                            </div>

                                            {/* Slot as Mana */}
                                            <div onClick={() => handleMagicChange('slotAsMana', !charData.magic?.slotAsMana)} className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${charData.magic?.slotAsMana ? 'bg-blue-900/10 border-blue-500/50' : 'bg-slate-950 border-slate-850 hover:border-slate-800'}`}>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-3">Slot Convertiti in Mana</span>
                                                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors mb-1 ${charData.magic?.slotAsMana ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-750 bg-slate-900'}`}>
                                                    {charData.magic?.slotAsMana && <Icons.Check />}
                                                </div>
                                                <span className="text-[9px] text-yellow-500 mt-2 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-850 font-bold">Costo: {charData.magic?.slotAsMana ? 10 : 0} CP</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* PSIONIC POWER */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
                                            <h3 className="text-md font-bold text-cyan-400 flex items-center gap-2">
                                                <span className="bg-cyan-500 w-1 h-5 rounded-full"></span> Psionic Power
                                            </h3>
                                            <div className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-lg text-yellow-500">
                                                {totalCPPsionicPowers} CP
                                            </div>
                                        </div>
                                        
                                        {!hasPsionicPowerFeature ? (
                                            <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3.5 text-center">
                                                <div className="text-xs font-semibold text-slate-400 mb-1">
                                                    Privilegio "Psionic Power" Non Acquisito
                                                </div>
                                                <div className="text-[11px] text-slate-500 leading-relaxed">
                                                    Questa sezione si attiva dopo aver acquistato il privilegio di classe <span className="text-cyan-400 font-bold">Psionic Power</span> (costo 1 CP) nella scheda "Class Features" (disponibile al Lv 1 per Psion, Lv 3 per Fighter Psi Warrior e Rogue Soulknife).
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Dropdown Selection */}
                                                <div className="flex gap-2 mb-4">
                                                    <div className="relative flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center px-3 py-2 text-xs">
                                                        <select 
                                                            value={psionicPowerSelection} 
                                                            onChange={(e) => setPsionicPowerSelection(e.target.value)} 
                                                            className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer" 
                                                        >
                                                            <option value="" className="bg-slate-900">Seleziona Potere Psionico...</option>
                                                            {availablePsionicPowers.map(p => (
                                                                <option key={p.id} value={p.id} className="bg-slate-900">{p.name} (2 CP)</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"><Icons.Filter /></div>
                                                    </div>
                                                    <button 
                                                        onClick={addPsionicPower} 
                                                        disabled={!psionicPowerSelection} 
                                                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors ${psionicPowerSelection ? 'bg-cyan-600 text-white hover:bg-cyan-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} 
                                                    >
                                                        Aggiungi
                                                    </button>
                                                </div>
                                                
                                                {/* Powers List */}
                                                <div className="space-y-3">
                                                    {(charData.psionicPowers || []).map((power, idx) => (
                                                        <div key={`${power.id}-${idx}`} className="bg-slate-950/45 border border-slate-850 rounded-xl p-3.5 relative group hover:border-slate-800 transition-all">
                                                            <button onClick={() => removePsionicPower(power.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors" title="Rimuovi Potere"><Icons.Trash /></button>
                                                            <div className="flex justify-between items-center pr-6 mb-1.5">
                                                                <div className="font-bold text-xs text-white">{power.name}</div>
                                                                {power.action && <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-cyan-300 border border-slate-850 font-bold uppercase">{power.action}</span>}
                                                            </div>
                                                            <div className="text-[10px] text-yellow-600 font-bold mb-2">Costo: 2 CP</div>
                                                            <div className="feature-html-desc text-xs text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatFeatureDesc(power.desc) }} />
                                                        </div>
                                                    ))}
                                                    {(charData.psionicPowers || []).length === 0 && (
                                                        <div className="text-slate-600 text-xs italic text-center py-4 border border-dashed border-slate-850 rounded-xl">
                                                            Nessun potere psionico selezionato.
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* PSIONIC DISCIPLINE */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl">
                                        <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
                                            <h3 className="text-md font-bold text-teal-400 flex items-center gap-2">
                                                <span className="bg-teal-500 w-1 h-5 rounded-full"></span> Psionic Discipline
                                            </h3>
                                            <div className="text-[10px] font-mono font-bold bg-slate-950 border border-slate-850 px-2 py-0.5 rounded-lg text-yellow-500">
                                                {totalCPPsionicDisciplines} CP
                                            </div>
                                        </div>
                                        
                                        {!hasPsionicDisciplineFeature ? (
                                            <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3.5 text-center">
                                                <div className="text-xs font-semibold text-slate-400 mb-1">
                                                    Privilegio "Psionic Discipline" Non Acquisito
                                                </div>
                                                <div className="text-[11px] text-slate-500 leading-relaxed">
                                                    Questa sezione si attiva dopo aver acquistato il privilegio di classe <span className="text-teal-400 font-bold">Psionic Discipline</span> (costo 1 CP) nella scheda "Class Features" (disponibile al Lv 3 per Psion).
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Dropdown Selection */}
                                                <div className="flex gap-2 mb-4">
                                                    <div className="relative flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center px-3 py-2 text-xs">
                                                        <select 
                                                            value={psionicDisciplineSelection} 
                                                            onChange={(e) => setPsionicDisciplineSelection(e.target.value)} 
                                                            className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer" 
                                                        >
                                                            <option value="" className="bg-slate-900">Seleziona Disciplina Psionica...</option>
                                                            {availablePsionicDisciplines.map(d => (
                                                                <option key={d.id} value={d.id} className="bg-slate-900">{d.name} (2 CP)</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"><Icons.Filter /></div>
                                                    </div>
                                                    <button 
                                                        onClick={addPsionicDiscipline} 
                                                        disabled={!psionicDisciplineSelection} 
                                                        className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors ${psionicDisciplineSelection ? 'bg-teal-600 text-white hover:bg-teal-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} 
                                                    >
                                                        Aggiungi
                                                    </button>
                                                </div>
                                                
                                                {/* Disciplines List */}
                                                <div className="space-y-3">
                                                    {(charData.psionicDisciplines || []).map((discipline, idx) => (
                                                        <div key={`${discipline.id}-${idx}`} className="bg-slate-950/45 border border-slate-850 rounded-xl p-3.5 relative group hover:border-slate-800 transition-all">
                                                            <button onClick={() => removePsionicDiscipline(discipline.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors" title="Rimuovi Disciplina"><Icons.Trash /></button>
                                                            <div className="flex justify-between items-center pr-6 mb-1.5">
                                                                <div className="font-bold text-xs text-white">{discipline.name}</div>
                                                                {discipline.action && <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-teal-300 border border-slate-850 font-bold uppercase">{discipline.action}</span>}
                                                            </div>
                                                            <div className="text-[10px] text-yellow-600 font-bold mb-2">Costo: 2 CP</div>
                                                            <div className="feature-html-desc text-xs text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatFeatureDesc(discipline.desc) }} />
                                                        </div>
                                                    ))}
                                                    {(charData.psionicDisciplines || []).length === 0 && (
                                                        <div className="text-slate-600 text-xs italic text-center py-4 border border-dashed border-slate-850 rounded-xl">
                                                            Nessuna disciplina psionica selezionata.
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* SPELLCASTING & CASTER LEVEL DETAILS */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-850 p-4 shadow-xl flex-1 flex flex-col min-h-[480px]">
                                        <h3 className="text-md font-bold text-blue-400 mb-4 flex items-center gap-2">
                                            <Icons.Sword /> Lancio Incantesimi
                                        </h3>

                                        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
                                            {/* Left panel: classes lists */}
                                            <div className="flex-1 bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col overflow-hidden max-h-[400px]">
                                                <h4 className="text-xs font-bold text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> Classi Incantatrici
                                                </h4>
                                                <div className="flex-1 overflow-y-auto pr-1.5 space-y-2 custom-scrollbar">
                                                    {SPELLCASTING_DATA.map((sc, idx) => {
                                                        const isSelected = (charData.spellcasting || []).includes(sc.name);
                                                        let reqClass = (sc.name.split(', ')[1] || sc.name).trim(); 
                                                        let hasPrereq = false;
                                                        let reqErrorText = `Richiede ${reqClass}`;

                                                        if (reqClass === 'Eldritch Knight') {
                                                            hasPrereq = (charData.classes || []).some(c => c.className === 'Fighter' && (parseInt(c.level) || 0) >= 3);
                                                            reqErrorText = 'Richiede Fighter Lv 3';
                                                        } else if (reqClass === 'Arcane Trickster') {
                                                            hasPrereq = (charData.classes || []).some(c => c.className === 'Rogue' && (parseInt(c.level) || 0) >= 3);
                                                            reqErrorText = 'Richiede Rogue Lv 3';
                                                        } else if (reqClass.includes('Monk') || reqClass.includes('Warrior of the Mystic Arts')) {
                                                            const hasMonkLevel = (charData.classes || []).some(c => c.className === 'Monk' && (parseInt(c.level) || 0) >= 3);
                                                            const hasMonkFeature = (charData.features || []).some(f => {
                                                                const fn = (typeof f === 'string' ? f : (f?.name || '')).toLowerCase();
                                                                return fn.includes('warrior of the mystic arts');
                                                            });
                                                            hasPrereq = hasMonkLevel || hasMonkFeature;
                                                            reqErrorText = 'Richiede Monk Lv 3';
                                                        } else {
                                                            hasPrereq = (charData.classes || []).some(c => c.className === reqClass && (parseInt(c.level) || 0) > 0);
                                                            reqErrorText = `Richiede ${reqClass}`;
                                                        }

                                                        return (
                                                            <div 
                                                                key={idx} 
                                                                onClick={() => { if (hasPrereq) toggleSpellcasting(sc.name); }}
                                                                className={`relative flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                                                                    !hasPrereq ? 'bg-slate-900/30 border-slate-900/60 opacity-35 cursor-not-allowed' :
                                                                    isSelected ? 'bg-blue-900/15 border-blue-500/40 cursor-pointer shadow-sm' :
                                                                    'bg-slate-900 border-slate-850 hover:border-slate-800 cursor-pointer'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                                                        !hasPrereq ? 'border-slate-850 bg-slate-900 text-slate-700' :
                                                                        isSelected ? 'bg-blue-500 border-blue-500 text-white' :
                                                                        'border-slate-750 bg-slate-950'
                                                                    }`}>
                                                                        {hasPrereq ? (isSelected && <Icons.Check />) : <Icons.Lock />}
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className={`text-xs font-bold leading-tight ${isSelected && hasPrereq ? 'text-white' : 'text-slate-400'}`}>
                                                                            {sc.displayName || sc.name.replace(/Spell\s?casting, /i, '')}
                                                                        </span>
                                                                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                                            {sc.ability && (
                                                                                <span className="text-[9px] text-slate-400 font-medium">
                                                                                    Stat: <strong className="text-cyan-400">{sc.ability}</strong>
                                                                                </span>
                                                                            )}
                                                                            {sc.spellList && (
                                                                                <span className="text-[9px] text-slate-500">
                                                                                    • Lista: <strong className="text-slate-300">{sc.spellList}</strong>
                                                                                </span>
                                                                            )}
                                                                            {sc.type && (
                                                                                <span className="text-[9px] text-purple-400 font-mono">
                                                                                    • {sc.type === 'third' ? '1/3 Caster' : sc.type === 'half' ? '1/2 Caster' : sc.type === 'pact' ? 'Pact Magic' : 'Full Caster'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {!hasPrereq && (
                                                                            <span className="text-[8px] text-red-500 font-bold uppercase tracking-wider mt-0.5">{reqErrorText}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold shrink-0 ml-2 ${hasPrereq ? 'text-yellow-500 bg-slate-950 border-slate-850' : 'text-slate-600 bg-slate-900 border-slate-900'}`}>
                                                                    {sc.cost} CP
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Right panel: Caster levels breakdown */}
                                            <div className="flex-1 bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col overflow-hidden max-h-[400px]">
                                                <h4 className="text-xs font-bold text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span> Caster Levels
                                                </h4>
                                                
                                                {/* summary level */}
                                                <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl mb-4 flex justify-between items-center shadow-md">
                                                    <div>
                                                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Livello Incantatore</span>
                                                        <span className="text-lg font-black text-purple-400 font-mono">
                                                            {(charData.magic?.casterSlots || []).reduce((acc, slot, idx) => {
                                                                if (!slot || !slot.active) return acc;
                                                                return acc + calculateCasterLevel(CASTER_SLOTS_CONFIG[idx].type, slot.level);
                                                            }, 0)}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider block">Costo Livelli</span>
                                                        <span className="text-sm font-black text-yellow-500 font-mono">
                                                            {(charData.magic?.casterSlots || []).reduce((acc, slot, idx) => {
                                                                if (!slot || !slot.active) return acc;
                                                                return acc + slot.level;
                                                            }, 0)} CP
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto pr-1.5 space-y-2 custom-scrollbar">
                                                    {CASTER_SLOTS_CONFIG.map((config, idx) => {
                                                        const slotData = (charData.magic?.casterSlots && charData.magic.casterSlots[idx]) 
                                                            ? charData.magic.casterSlots[idx] 
                                                            : { active: false, level: 1 };
                                                        
                                                        const resultLevel = calculateCasterLevel(config.type, slotData.level);

                                                        return (
                                                            <div key={idx} className={`p-2.5 rounded-lg border transition-all ${slotData.active ? 'bg-purple-950/10 border-purple-500/30' : 'bg-slate-900 border-slate-850'}`}>
                                                                <div className="flex items-center gap-3">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={slotData.active}
                                                                        onChange={() => handleCasterSlotChange(idx, 'active')}
                                                                        className="accent-purple-500 w-3.5 h-3.5 cursor-pointer"
                                                                    />
                                                                    <span className={`text-[11px] font-bold flex-1 ${slotData.active ? 'text-white' : 'text-slate-450'}`}>
                                                                        {config.label.replace('Spell caster level, ', '')}
                                                                    </span>
                                                                </div>

                                                                {slotData.active && (
                                                                    <div className="flex items-center justify-between pl-6 mt-2 pt-2 border-t border-slate-800/40">
                                                                        <div className="flex items-center gap-1.5 text-xs">
                                                                            <span className="text-[9px] text-slate-500 font-bold uppercase">Liv.</span>
                                                                            <select 
                                                                                value={slotData.level}
                                                                                onChange={(e) => handleCasterSlotChange(idx, 'level', e.target.value)}
                                                                                className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 outline-none text-xs text-white font-mono"
                                                                            >
                                                                                {Array.from({length: 20}, (_, i) => i + 1).map(l => (
                                                                                    <option key={l} value={l}>{l}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                        
                                                                        <div className="text-right">
                                                                            <span className="text-[8px] text-slate-500 block uppercase font-bold tracking-wider">Caster Level (+{resultLevel})</span>
                                                                            <span className="text-xs font-mono font-bold text-yellow-500">{slotData.level} CP</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TABS SELECTOR (BOTTOM BAR) */}
                    <div 
                        className="bg-slate-900 border-t border-slate-850 flex justify-around items-center z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.25)] flex-shrink-0"
                        style={{ 
                            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                            height: 'calc(4.2rem + env(safe-area-inset-bottom, 0px))'
                        }}
                    >
                        <button onClick={() => setActiveTab('basic')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${activeTab === 'basic' ? 'text-blue-400 bg-slate-850/30 border-t-2 border-blue-500' : 'text-slate-500 hover:text-slate-350 hover:bg-slate-850/10'}`}>
                            <Icons.Calculator /><span className="text-[10px] font-bold uppercase tracking-wider mt-1.5">Parametri Base</span>
                        </button>
                        <div className="h-8 w-px bg-slate-850"></div>
                        <button onClick={() => setActiveTab('features')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${activeTab === 'features' ? 'text-blue-400 bg-slate-850/30 border-t-2 border-blue-500' : 'text-slate-500 hover:text-slate-350 hover:bg-slate-850/10'}`}>
                            <Icons.List /><span className="text-[10px] font-bold uppercase tracking-wider mt-1.5">Class Features</span>
                        </button>
                        <div className="h-8 w-px bg-slate-850"></div>
                        <button onClick={() => setActiveTab('combat_magic')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${activeTab === 'combat_magic' ? 'text-blue-400 bg-slate-850/30 border-t-2 border-blue-500' : 'text-slate-500 hover:text-slate-350 hover:bg-slate-850/10'}`}>
                            <Icons.Sword /><span className="text-[10px] font-bold uppercase tracking-wider mt-1.5">Combattimento & Magia</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
