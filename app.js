// --- COMPONENTE PRINCIPALE ---
        function App() {
            // DATABASE STATES
            const [db, setDb] = React.useState([]);
            const [featsDb, setFeatsDb] = React.useState([]);
            const [proficiencyDb, setProficiencyDb] = React.useState([]);
            const [fightingStylesDb, setFightingStylesDb] = React.useState([]);
            const [cunningStrikesDb, setCunningStrikesDb] = React.useState([]);
            const [metamagicDb, setMetamagicDb] = React.useState([]);

            // MEMOIZED MAPS (OPTIMIZATION 1: LOOKUP MAPS)
            const dbMap = React.useMemo(() => {
                if (!db) return {};
                return db.reduce((acc, item) => { 
                    if (item && item.id) acc[item.id] = item; 
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

            const metamagicMap = React.useMemo(() => {
                if (!metamagicDb) return {};
                return metamagicDb.reduce((acc, item) => {
                    if (item && item.id) acc[item.id] = item;
                    return acc;
                }, {});
            }, [metamagicDb]);

            const proficiencyMap = React.useMemo(() => {
                if (!proficiencyDb) return {};
                return proficiencyDb.reduce((acc, item) => { 
                    if (item && item.className) acc[item.className] = item; 
                    return acc; 
                }, {});
            }, [proficiencyDb]);

            // UI STATES
            const [selectedTags, setSelectedTags] = React.useState([]); 
            const [search, setSearch] = React.useState('');
            const [activeTab, setActiveTab] = React.useState('basic'); 
            const [showImport, setShowImport] = React.useState(false);
            const [csvText, setCsvText] = React.useState('');
            const [importType, setImportType] = React.useState('features'); 
            const [activeModal, setActiveModal] = React.useState(null); 
            const [tempName, setTempName] = React.useState('');
            const [showSelectedOnly, setShowSelectedOnly] = React.useState(false);

            // PROFILES
            const [profiles, setProfiles] = React.useState(['Personaggio 1']);
            const [currentProfile, setCurrentProfile] = React.useState('Personaggio 1');

            // CURRENT CHARACTER STATE
            const [charData, setCharData] = React.useState({
                features: [],
                stats: JSON.parse(JSON.stringify(DEFAULT_STATS)),
                charPower: { level: 1, cpPerLevel: 12.5 },
                classes: [],
                feats: [],
                skills: {},
                savingThrows: { STR: false, DEX: false, CON: false, INT: false, WIS: false, CHA: false },
                fightingStyles: [],
                cunningStrikes: [],
                metamagic: [],
                magic: { extraSpells: 0, extraSlots: 0, slotAsMana: false },
                spellcasting: []
            });

            // FEAT SELECTION TEMP STATE
            const [featSelection, setFeatSelection] = React.useState("");
            const [fightingStyleSelection, setFightingStyleSelection] = React.useState("");
            const [cunningStrikeSelection, setCunningStrikeSelection] = React.useState("");
            const [metamagicSelection, setMetamagicSelection] = React.useState("");
            
            // REFS
            const fileInputRef = React.useRef(null);
            const csvFileInputRef = React.useRef(null);

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
            
            // --- PARSERS (Senza caching persistente) ---
            const parseFeaturesCSV = (text) => {
                Papa.parse(text, {
                    header: true,
                    skipEmptyLines: true,
                    complete: function(results) {
                        const newItems = results.data.map((row, index) => {
                            if (!row["Name"]) return null; 
                            return {
                                id: index + 1, 
                                name: row["Name"],
                                tag: row["Class Tag"] || "Generico",
                                cp: parseInt(row["Creation Points"] || 0),
                                req: parseInt(row["Class Power"] || 0),
                                ap: row["Action Points"] || "-",
                                desc: row["Description"] || "",
                                pre: row["Prerequistes"] || "-" 
                            };
                        }).filter(Boolean);
                        setDb(newItems);
                        // RIMOSSO: localStorage.setItem('d20_db_data', ...)
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
                        // RIMOSSO: localStorage.setItem('d20_feats_db', ...)
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
                         // RIMOSSO: localStorage.setItem('d20_fighting_styles_db', ...)
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
                         // RIMOSSO: localStorage.setItem('d20_cunning_strikes_db', ...)
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
                         // RIMOSSO: localStorage.setItem('d20_metamagic_db', ...)
                    }
                });
            };
            
            // --- INITIALIZATION (ALWAYS LOAD FRESH DATA) ---
            React.useEffect(() => {
                // 1. Pulizia preventiva della cache DB (Opzionale, ma consigliata per pulire il telefono degli utenti)
                // Nota: Non tocchiamo 'd20_profiles' o 'd20_profile_...', così i PG sono salvi.
                localStorage.removeItem('d20_db_data');
                localStorage.removeItem('d20_feats_db');
                localStorage.removeItem('d20_fighting_styles_db');
                localStorage.removeItem('d20_cunning_strikes_db');
                localStorage.removeItem('d20_metamagic_db');

                // 2. Caricamento DIRETTO dai CSV nel codice
                // Questo garantisce che ciò che scrivi nel file HTML sia ciò che l'utente vede.
                parseFeaturesCSV(PRELOADED_CSV);
                parseFeatsCSV(PRELOADED_FEATS_CSV);
                parseFightingStylesCSV(PRELOADED_FIGHTING_STYLES_CSV);
                parseCunningStrikesCSV(PRELOADED_CUNNING_STRIKES_CSV);
                parseMetamagicCSV(PRELOADED_METAMAGIC_CSV);
                
                // 3. Caricamento Proficiency
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

                // 4. Caricamento PROFILI UTENTE (Questi vanno mantenuti dal localStorage!)
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
                    const parsed = JSON.parse(dataStr);
                    if (!parsed.savingThrows) parsed.savingThrows = { STR: false, DEX: false, CON: false, INT: false, WIS: false, CHA: false };
                    if (!parsed.fightingStyles) parsed.fightingStyles = [];
                    if (!parsed.cunningStrikes) parsed.cunningStrikes = [];
                    if (!parsed.metamagic) parsed.metamagic = [];
                    if (!parsed.magic) parsed.magic = { extraSpells: 0, extraSlots: 0, slotAsMana: false };
                    if (!parsed.spellcasting) parsed.spellcasting = [];
                    setCharData(parsed);
                } else {
                    setCharData({
                        features: [],
                        stats: JSON.parse(JSON.stringify(DEFAULT_STATS)),
                        charPower: { level: 1, cpPerLevel: 12.5 },
                        classes: [],
                        feats: [],
                        skills: {},
                        savingThrows: { STR: false, DEX: false, CON: false, INT: false, WIS: false, CHA: false },
                        fightingStyles: [],
                        cunningStrikes: [],
                        metamagic: [],
                        magic: { extraSpells: 0, extraSlots: 0, slotAsMana: false },
                        spellcasting: []
                    });
                }
                localStorage.setItem('d20_active_profile', currentProfile);
            }, [currentProfile]);

            // --- SAVE DATA AUTOMATICALLY ---
            React.useEffect(() => {
                if (currentProfile) {
                    localStorage.setItem(`d20_profile_${currentProfile}`, JSON.stringify(charData));
                }
            }, [charData, currentProfile]);

            // --- DATA UPDATE HANDLER (Optimized) ---
            const updateCharData = React.useCallback((field, value) => {
                setCharData(prev => ({ ...prev, [field]: value }));
            }, []);

            // --- CALCULATIONS (Memoized) ---
            const calculateFinalScore = (s) => s.base + s.race + s.feat + s.ability + s.misc;

            const calculateTotalBP = React.useCallback(() => 
                Object.values(charData.stats).reduce((acc, s) => acc + POINT_BUY_COSTS[s.base], 0)
            , [charData.stats]);

            const totalAbilityScore = React.useMemo(() => 
                Object.values(charData.stats).reduce((acc, s) => acc + (s.ability || 0), 0)
            , [charData.stats]);
            
            const abilityCostCP = totalAbilityScore * 2;
            const totalCPAvailable = Math.ceil(charData.charPower.level * charData.charPower.cpPerLevel);
            
            const totalCPClasses = React.useMemo(() => charData.classes.reduce((acc, item) => {
                let cost = parseInt(item.level) || 0;
                if (item.showProficiency) {
                    const prof = proficiencyMap[item.className];
                    if (prof) cost += parseInt(prof.cost) || 0;
                }
                return acc + cost;
            }, 0), [charData.classes, proficiencyMap]);

            const totalCPFeats = React.useMemo(() => charData.feats.reduce((acc, f) => acc + (f.isBonus ? 0 : f.cost), 0), [charData.feats]);

            const totalHpCost = React.useMemo(() => charData.classes.reduce((acc, cls) => {
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
            
            const totalCPFightingStyles = React.useMemo(() => (charData.fightingStyles || []).length * 3, [charData.fightingStyles]);
            const totalCPCunningStrikes = React.useMemo(() => (charData.cunningStrikes || []).length * 2, [charData.cunningStrikes]);
            const totalCPMetamagic = React.useMemo(() => {
                return (charData.metamagic || []).reduce((acc, item) => {
                    if (typeof item === 'string') return acc + 2;
                    return acc + (item.isSorcerer ? 0 : 2);
                }, 0);
            }, [charData.metamagic]);
            
            const totalCPMagic = React.useMemo(() => {
                const m = charData.magic || { extraSpells: 0, extraSlots: 0, slotAsMana: false };
                let base = (m.extraSpells || 0) * 1 + (m.extraSlots || 0) * 10 + (m.slotAsMana ? 10 : 0);
                
                const spellcastingCost = (charData.spellcasting || []).reduce((acc, scName) => {
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

            // MODIFICA: Calcolo CP Features ora lavora su oggetti completi
            const totalCPSpent = React.useMemo(() => charData.features.reduce((acc, feat) => {
                // Supporta sia oggetto completo che ID per sicurezza
                const f = (typeof feat === 'object') ? feat : dbMap[feat];
                return acc + (f ? f.cp : 0);
            }, 0) + totalCPClasses + totalCPFeats + abilityCostCP + totalHpCost + totalSkillCost + totalCPFightingStyles + totalCPCunningStrikes + totalCPMetamagic + totalCPMagic,
            [charData.features, dbMap, totalCPClasses, totalCPFeats, abilityCostCP, totalHpCost, totalSkillCost, totalCPFightingStyles, totalCPCunningStrikes, totalCPMetamagic, totalCPMagic]);

            // HP Calc
            const conMod = getAbilityMod(calculateFinalScore(charData.stats.CON));
            const hpClass = charData.classes.find(c => c.showProficiency);
            const currentHpPerLevel = hpClass ? (hpClass.selectedHp || getHpPerLevel(hpClass.className)) : 0;
            const totalHP = (currentHpPerLevel + conMod) * charData.charPower.level;
            const bpUsed = calculateTotalBP();

            // --- FILTERING & PREREQUISITES ---
            // MODIFICA: Mappa i nomi direttamente dagli oggetti salvati
            const selectedFeatureNames = React.useMemo(() => new Set(charData.features.map(f => {
                const featObj = (typeof f === 'object') ? f : dbMap[f];
                return featObj ? featObj.name.trim().toLowerCase() : null;
            }).filter(Boolean)), [dbMap, charData.features]);

            const checkPrereq = React.useCallback((str) => {
                if (!str || str === '-') return true;
                return selectedFeatureNames.has(str.trim().toLowerCase());
            }, [selectedFeatureNames]);

            const checkClassPrereq = React.useCallback((feature) => {
                const baseClass = FIXED_CLASSES_LIST.find(cls => feature.tag.includes(cls));
                if (!baseClass) return { allowed: true };
                const userHas = charData.classes.find(c => c.className === baseClass);
                if (!userHas) return { allowed: false, msg: `Richiede ${baseClass}` };
                if (userHas.level < feature.req) return { allowed: false, msg: `Richiede ${baseClass} Lv ${feature.req}` };
                return { allowed: true, msg: '' };
            }, [charData.classes]);

            // --- AUTO-VALIDAZIONE & MIGRATION ---
            React.useEffect(() => {
                if (db.length === 0) return;

                const migrateList = (list, sourceMap, isMetamagic = false) => {
                    return list.map(item => {
                        // Se è già un oggetto completo, tienilo
                        if (typeof item === 'object' && item !== null && item.name) return item;
                        
                        // Se è un ID (stringa), cercalo nel DB
                        const id = typeof item === 'object' ? item.id : item;
                        const found = sourceMap[id];
                        
                        if (!found) return null; // Se non esiste, rimuovilo
                        
                        // Per Metamagic, aggiungi il flag Sorcerer di default
                        if (isMetamagic) {
                            const isSorc = (typeof item === 'object' && item.isSorcerer) || false;
                            return { ...found, isSorcerer: isSorc };
                        }
                        
                        return found;
                    }).filter(Boolean);
                };

                // Controlla e Migra
                let newData = { ...charData };
                let hasChanges = false;

                // 1. Features
                if (charData.features.some(f => typeof f === 'number' || typeof f === 'string')) {
                    newData.features = migrateList(charData.features, dbMap);
                    hasChanges = true;
                }
                // 2. Fighting Styles
                if (charData.fightingStyles.some(s => typeof s === 'string')) {
                    newData.fightingStyles = migrateList(charData.fightingStyles, fightingStylesDb);
                    hasChanges = true;
                }
                // 3. Cunning Strikes
                if (charData.cunningStrikes.some(c => typeof c === 'string')) {
                    newData.cunningStrikes = migrateList(charData.cunningStrikes, cunningStrikesDb);
                    hasChanges = true;
                }
                // 4. Metamagic
                if (charData.metamagic.some(m => typeof m === 'string' || (typeof m === 'object' && !m.name))) {
                    newData.metamagic = migrateList(charData.metamagic, metamagicDb, true);
                    hasChanges = true;
                }

                if (hasChanges) {
                    console.log("Migrazione dati completata.");
                    setCharData(newData);
                }
            }, [charData.features, charData.fightingStyles, charData.cunningStrikes, charData.metamagic, dbMap, fightingStylesDb, cunningStrikesDb, metamagicDb, db.length]); 

            const toggleFeature = (id) => {
                // MODIFICA FONDAMENTALE: Gestione Oggetti
                const exists = charData.features.some(f => f.id === id);
                if (exists) {
                    updateCharData('features', charData.features.filter(f => f.id !== id));
                    return;
                }
                const f = dbMap[id];
                if (f) {
                    if (f.pre && f.pre !== '-') {
                        const reqs = f.pre.split(';').map(t => t.trim());
                        if (reqs.some(r => !selectedFeatureNames.has(r.toLowerCase()))) return;
                    }
                    if (!checkClassPrereq(f).allowed) return;
                    // SALVA L'INTERO OGGETTO, NON SOLO L'ID
                    updateCharData('features', [...charData.features, f]);
                }
            };

            const classes = React.useMemo(() => [...new Set(db.flatMap(f => f.tag.split(';').map(t => t.trim())).filter(Boolean))].sort(), [db]);
            
            const filteredData = React.useMemo(() => db.filter(item => {
                // MODIFICA: Check su id nell'array di oggetti
                if (showSelectedOnly && !charData.features.some(f => f.id === item.id)) return false;
                const tags = item.tag.split(';').map(t => t.trim());
                const matchTag = selectedTags.length === 0 || selectedTags.some(t => tags.includes(t));
                const matchSearch = (item.name + item.desc + item.pre).toLowerCase().includes(search.toLowerCase());
                return matchTag && matchSearch;
            }), [db, selectedTags, search, showSelectedOnly, charData.features]);

            const toggleTag = (tag) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

            const selectedItemsList = charData.features.map(id => dbMap[id]).filter(Boolean);
            const availableFeats = React.useMemo(() => featsDb.filter(f => !charData.feats.some(sf => sf.id === f.id)).sort((a,b) => a.name.localeCompare(b.name)), [featsDb, charData.feats]);
            const availableFightingStyles = React.useMemo(() => fightingStylesDb.filter(s => !charData.fightingStyles.includes(s.id)).sort((a,b) => a.name.localeCompare(b.name)), [fightingStylesDb, charData.fightingStyles]);
            const availableCunningStrikes = React.useMemo(() => cunningStrikesDb.filter(s => !charData.cunningStrikes.includes(s.id)).sort((a,b) => a.name.localeCompare(b.name)), [cunningStrikesDb, charData.cunningStrikes]);
            const availableMetamagic = React.useMemo(() => metamagicDb.filter(s => {
                // Supporta sia formato vecchio (stringhe) che nuovo (oggetti)
                return !charData.metamagic.some(m => (typeof m === 'string' ? m : m.id) === s.id);
            }).sort((a,b) => a.name.localeCompare(b.name)), [metamagicDb, charData.metamagic]);

            const hpClassesForDisplay = React.useMemo(() => charData.classes.filter(c => c.showProficiency), [charData.classes]);

			// --- AUTO-VALIDAZIONE SPELLCASTING ---
            // Se cambiano le classi, controlla se i permessi di spellcasting sono ancora validi
            React.useEffect(() => {
                const currentSc = charData.spellcasting || [];
                if (currentSc.length === 0) return;

                const validSc = currentSc.filter(scName => {
                    let reqClass = scName.split(', ')[1]; // Es: "Wizard" da "Spellcasting, Wizard"
                    
                    // Gestione eccezioni nomi composti/sottoclassi
                    if (reqClass === 'Eldritch Knight') reqClass = 'Fighter';
                    if (reqClass === 'Arcane Trickster') reqClass = 'Rogue';
                    
                    // Mantieni solo se il PG ha almeno 1 livello in quella classe
                    return charData.classes.some(c => c.className === reqClass && c.level > 0);
                });

                // Se la lista valida è diversa da quella attuale, aggiorna (deseleziona gli invalidi)
                if (validSc.length !== currentSc.length) {
                    updateCharData('spellcasting', validSc);
                }
            }, [charData.classes, charData.spellcasting, updateCharData]);
			
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
                    charPower: {
                        ...prev.charPower,
                        [field]: value
                    }
                }));
            }, []);
            
            const handleMagicChange = React.useCallback((field, value) => {
                setCharData(prev => ({
                    ...prev,
                    magic: {
                        ...prev.magic,
                        [field]: value
                    }
                }));
            }, []);
			
			// --- LOGICA CASTER LEVEL (DA AGGIUNGERE) ---
            const CASTER_SLOTS_CONFIG = [
                { label: "Spell caster level, full caster", type: "full" },
                { label: "Spell caster level, full caster", type: "full" },
                { label: "Spell caster level, half caster", type: "half" },
                { label: "Spell caster level, half caster", type: "half" },
                { label: "Spell caster level, 1/3 caster", type: "third" },
                { label: "Spell caster level, 1/3 caster", type: "third" }
            ];

            const handleCasterSlotChange = (index, field, value) => {
                const currentMagic = charData.magic || {};
                // Inizializza l'array se non esiste o se è più corto della config
                const currentSlots = currentMagic.casterSlots || [];
                const newSlots = CASTER_SLOTS_CONFIG.map((cfg, i) => {
                    return currentSlots[i] || { active: false, level: 1 };
                });

                // Aggiorna il valore specifico
                if (field === 'active') newSlots[index].active = !newSlots[index].active;
                else newSlots[index][field] = parseInt(value) || 1;

                updateCharData('magic', { ...currentMagic, casterSlots: newSlots });
            };

            const calculateCasterLevel = (type, level) => {
                if (type === 'full') return level;
                if (type === 'half') return Math.ceil(level / 2); // Arrotondato per eccesso
                if (type === 'third') return Math.floor(level / 3); // Arrotondato per difetto
                return 0;
            };

            const addClass = () => updateCharData('classes', [...charData.classes, { className: '', level: 1, showProficiency: false, selectedHp: 0 }]);
            const removeClass = (index) => updateCharData('classes', charData.classes.filter((_, i) => i !== index));

            const updateClass = (index, field, value) => {
                if (field === 'level' && parseInt(value) > charData.charPower.level) {
                    alert(`Errore: Livello classe (${value}) > Livello Personaggio (${charData.charPower.level}).`);
                    return;
                }
                const newClasses = [...charData.classes];
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
                const newClasses = charData.classes.map((cls, idx) => {
                    if (idx === index) return { ...cls, showProficiency: !cls.showProficiency };
                    if (!charData.classes[index].showProficiency) return { ...cls, showProficiency: false };
                    return cls;
                });
                updateCharData('classes', newClasses);
            };

            const updateClassHp = (classIndex, value) => {
                const newClasses = [...charData.classes];
                newClasses[classIndex] = { ...newClasses[classIndex], selectedHp: parseInt(value) || 0 };
                updateCharData('classes', newClasses);
            };

            const addFeat = () => {
                if (!featSelection) return;
                const featToAdd = featsMap[featSelection];
                if (featToAdd && !charData.feats.some(f => f.id === featToAdd.id)) {
                    updateCharData('feats', [...charData.feats, { ...featToAdd, isBonus: false }]);
                    setFeatSelection("");
                }
            };
            const removeFeat = (index) => updateCharData('feats', charData.feats.filter((_, i) => i !== index));
            const toggleBonusFeat = (index) => {
                const newFeats = [...charData.feats];
                newFeats[index].isBonus = !newFeats[index].isBonus;
                updateCharData('feats', newFeats);
            };

            const addFightingStyle = () => {
                if (!fightingStyleSelection) return;
                const styleObj = fightingStylesDb.find(s => s.id === fightingStyleSelection); // Trova l'oggetto
                if (styleObj) {
                    // Salva l'OGGETTO, non l'ID
                    updateCharData('fightingStyles', [...charData.fightingStyles, styleObj]);
                    setFightingStyleSelection("");
                }
            };

            const removeFightingStyle = (styleId) => {
                // Filtra confrontando gli ID degli oggetti salvati
                updateCharData('fightingStyles', charData.fightingStyles.filter(s => s.id !== styleId));
            };

            const addCunningStrike = () => {
                if (!cunningStrikeSelection) return;
                const strikeObj = cunningStrikesDb.find(s => s.id === cunningStrikeSelection); // Trova l'oggetto
                if (strikeObj) {
                    updateCharData('cunningStrikes', [...charData.cunningStrikes, strikeObj]);
                    setCunningStrikeSelection("");
                }
            };

            const removeCunningStrike = (styleId) => {
                updateCharData('cunningStrikes', charData.cunningStrikes.filter(s => s.id !== styleId));
            };

            const addMetamagic = () => {
                if (!metamagicSelection) return;
                const mmObj = metamagicDb.find(m => m.id === metamagicSelection); // Trova l'oggetto
                if (mmObj) {
                    // Salva oggetto + flag sorcerer
                    updateCharData('metamagic', [...charData.metamagic, { ...mmObj, isSorcerer: false }]);
                    setMetamagicSelection("");
                }
            };

            const removeMetamagic = (styleId) => {
                updateCharData('metamagic', charData.metamagic.filter(item => {
                    const currentId = typeof item === 'string' ? item : item.id;
                    return currentId !== styleId;
                }));
            };

            const toggleSorcererMetamagic = (styleId) => {
                const newMeta = charData.metamagic.map(item => {
                    // Normalizza stringa in oggetto se necessario
                    const currentItem = typeof item === 'string' ? { id: item, isSorcerer: false } : { ...item };
                    if (currentItem.id === styleId) {
                        currentItem.isSorcerer = !currentItem.isSorcerer;
                    }
                    return currentItem;
                });
                updateCharData('metamagic', newMeta);
            };
            
            const toggleSpellcasting = (scName) => {
                const current = charData.spellcasting || [];
                if (current.includes(scName)) {
                    updateCharData('spellcasting', current.filter(n => n !== scName));
                } else {
                    updateCharData('spellcasting', [...current, scName]);
                }
            };

            const toggleSkill = (skillName, type) => {
                const current = charData.skills[skillName] || { isProficient: false, isClassSkill: false, isExpert: false };
                let updated = { ...current };
                if (type === 'prof') {
                    updated.isProficient = !current.isProficient;
                    if (!updated.isProficient) { updated.isClassSkill = false; updated.isExpert = false; }
                } else if (type === 'class') updated.isClassSkill = !current.isClassSkill;
                else if (type === 'expert') updated.isExpert = !current.isExpert;
                updateCharData('skills', { ...charData.skills, [skillName]: updated });
            };

            const toggleSavingThrow = (stat) => {
                const current = charData.savingThrows || {};
                updateCharData('savingThrows', { ...current, [stat]: !current[stat] });
            };
            
            const handleCreateProfile = () => {
                const name = prompt("Nome del nuovo personaggio:");
                if (name && !profiles.includes(name)) {
                    const newProfiles = [...profiles, name];
                    setProfiles(newProfiles);
                    localStorage.setItem('d20_profiles', JSON.stringify(newProfiles));
                    setCurrentProfile(name);
                } else if (profiles.includes(name)) alert("Esiste già.");
            };

            const handleDeleteProfile = () => {
                if (profiles.length <= 1) { alert("Devi avere almeno un profilo."); return; }
                if (confirm(`Eliminare ${currentProfile}?`)) {
                    const newProfiles = profiles.filter(p => p !== currentProfile);
                    localStorage.removeItem(`d20_profile_${currentProfile}`);
                    setProfiles(newProfiles);
                    localStorage.setItem('d20_profiles', JSON.stringify(newProfiles));
                    setCurrentProfile(newProfiles[0]);
                }
            };
            
            const openDuplicateModal = () => { setTempName(currentProfile + " (Copia)"); setActiveModal('duplicate'); };
            const confirmDuplicate = () => {
                if(!tempName.trim() || profiles.includes(tempName)) { alert("Nome non valido o esistente."); return; }
                const newProfiles = [...profiles, tempName];
                setProfiles(newProfiles);
                localStorage.setItem('d20_profiles', JSON.stringify(newProfiles));
                localStorage.setItem(`d20_profile_${tempName}`, JSON.stringify(charData));
                setCurrentProfile(tempName);
                setActiveModal(null);
            };

            const openRenameModal = () => { setTempName(currentProfile); setActiveModal('rename'); };
            const confirmRename = () => {
                if(!tempName.trim() || (tempName !== currentProfile && profiles.includes(tempName))) { alert("Nome non valido."); return; }
                if(tempName === currentProfile) { setActiveModal(null); return; }
                const newProfiles = profiles.map(p => p === currentProfile ? tempName : p);
                setProfiles(newProfiles);
                localStorage.setItem('d20_profiles', JSON.stringify(newProfiles));
                const data = localStorage.getItem(`d20_profile_${currentProfile}`);
                localStorage.setItem(`d20_profile_${tempName}`, data);
                localStorage.removeItem(`d20_profile_${currentProfile}`);
                setCurrentProfile(tempName);
                setActiveModal(null);
            };
			
			// --- EXPORT SUMMARY HANDLER ---
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
                if(charData.feats.length === 0) text += `(Nessuno)\n`;
                charData.feats.forEach(f => {
                    text += `- ${f.name} (${f.cost} CP)\n`;
                });
                text += `\n`;

                text += `--- CLASS FEATURES ---\n`;
                if(charData.features.length === 0) text += `(Nessuna)\n`;
                // MODIFICA: Itera direttamente gli oggetti feature salvati
                charData.features.forEach(f => {
                    const featObj = (typeof f === 'object') ? f : dbMap[f];
                    if (featObj) text += `- ${featObj.name} (${featObj.cp} CP)\n`;
                });
                text += `\n`;

                text += `--- COMBAT ---\n`;
                if (charData.fightingStyles.length) {
                    text += `Fighting Styles:\n`;
                    charData.fightingStyles.forEach(id => {
                        const s = fightingStylesMap[id];
                        if (s) text += `  * ${s.name}\n`;
                    });
                }
                if (charData.cunningStrikes.length) {
                    text += `Cunning Strikes:\n`;
                    charData.cunningStrikes.forEach(id => {
                        const s = cunningStrikesMap[id];
                        if (s) text += `  * ${s.name}\n`;
                    });
                }
                text += `\n`;

                text += `--- MAGIC ---\n`;
                if (charData.spellcasting && charData.spellcasting.length) {
                    text += `Spellcasting Classes: ${charData.spellcasting.join(', ').replace(/Spellcasting, /g, '')}\n`;
                }
                const totalCasterLevel = (charData.magic.casterSlots || []).reduce((acc, slot, idx) => {
                    if (!slot || !slot.active) return acc;
                    return acc + calculateCasterLevel(CASTER_SLOTS_CONFIG[idx].type, slot.level);
                }, 0);
                if (totalCasterLevel > 0) text += `Total Caster Level: ${totalCasterLevel}\n`;
                
                if (charData.metamagic.length) {
                    text += `Metamagic:\n`;
                    charData.metamagic.forEach(item => {
                        const itemId = typeof item === 'string' ? item : item.id;
                        const isSorcerer = typeof item === 'string' ? false : item.isSorcerer;
                        const m = metamagicMap[itemId];
                        if (m) text += `  * ${m.name}${isSorcerer ? ' (Sorcerer - Free)' : ''}\n`;
                    });
                }
                
                const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${currentProfile.replace(/\s+/g, '_')}_summary.txt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            const handleDownloadSave = (single = false) => {
                const saveData = single ? 
                    { type: 'single_character', profileName: currentProfile, data: charData, date: new Date().toISOString() } :
                    { type: 'full_backup', db: db, featsDb: featsDb, profiles: profiles, profilesData: profiles.reduce((acc, p) => ({...acc, [p]: JSON.parse(localStorage.getItem(`d20_profile_${p}`))}), {}), date: new Date().toISOString() };
                const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: "application/json" });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = single ? `d20_${currentProfile.replace(/\s+/g,'_')}.json` : "d20_backup_full.json";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            // --- GESTIONE IMPORTAZIONE SICURA ---
            const handleLoadSave = (event) => {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const content = JSON.parse(e.target.result);
                        
                        // 1. IMPORT SINGOLO PERSONAGGIO (CONDIVISIONE)
                        if (content.type === 'single_character') {
                            let newName = content.profileName;

                            // Verifica se il nome esiste già
                            if (profiles.includes(newName)) {
                                // Genera un nome suggerito univoco
                                let suggestedName = `${newName} (Import)`;
                                let counter = 2;
                                while (profiles.includes(suggestedName)) {
                                    suggestedName = `${newName} (Import ${counter})`;
                                    counter++;
                                }

                                // Chiede all'utente come procedere
                                const userChoice = prompt(
                                    `ATTENZIONE: Hai già un personaggio chiamato "${newName}".\n\n` +
                                    `Per evitare di sovrascriverlo, inserisci un nuovo nome per questo personaggio importato:`,
                                    suggestedName
                                );

                                if (userChoice === null) return; // Annulla operazione
                                newName = userChoice.trim();
                                
                                // Ultimo controllo di sicurezza se l'utente ha rimesso il nome originale
                                if (profiles.includes(newName)) {
                                    if (!confirm(`Sei sicuro di voler SOVRASCRIVERE il personaggio esistente "${newName}"? I dati precedenti andranno persi.`)) {
                                        return;
                                    }
                                }
                            }

                            // Salvataggio effettivo
                            localStorage.setItem(`d20_profile_${newName}`, JSON.stringify(content.data));
                            
                            // Aggiungi alla lista profili se non esiste
                            if (!profiles.includes(newName)) {
                                const newProfiles = [...profiles, newName];
                                setProfiles(newProfiles);
                                localStorage.setItem('d20_profiles', JSON.stringify(newProfiles));
                            }
                            
                            setCurrentProfile(newName);
                            alert(`Personaggio "${newName}" caricato con successo!`);
                        } 
                        
                        // 2. IMPORT BACKUP COMPLETO (DATABASE + PROFILI)
                        else if (content.db && content.profiles) {
                            if(!confirm("Stai caricando un Backup Completo. Questo sostituirà TUTTI i tuoi personaggi e database attuali. Continuare?")) return;
                            
                            setDb(content.db);
                            localStorage.setItem('d20_db_data', JSON.stringify(content.db));
                            if (content.featsDb) { setFeatsDb(content.featsDb); localStorage.setItem('d20_feats_db', JSON.stringify(content.featsDb)); }
                            
                            setProfiles(content.profiles);
                            localStorage.setItem('d20_profiles', JSON.stringify(content.profiles));
                            
                            if (content.profilesData) {
                                Object.keys(content.profilesData).forEach(p => {
                                    localStorage.setItem(`d20_profile_${p}`, JSON.stringify(content.profilesData[p]));
                                });
                            }
                            setCurrentProfile(content.profiles[0]);
                            alert("Backup completo ripristinato.");
                        }
                    } catch (error) { 
                        console.error(error);
                        alert("Errore durante la lettura del file. Verifica che sia un file JSON valido."); 
                    }
                };
                reader.readAsText(file);
                event.target.value = ''; // Reset input
            };
			
			const loadDefaultDatabases = () => {
                localStorage.removeItem('d20_fighting_styles_db'); // Rimuove specificamente la vecchia cache
                
                // Ricarica tutto dai CSV costanti
                parseFeaturesCSV(PRELOADED_CSV);
                parseFeatsCSV(PRELOADED_FEATS_CSV);
                parseFightingStylesCSV(PRELOADED_FIGHTING_STYLES_CSV);
                parseCunningStrikesCSV(PRELOADED_CUNNING_STRIKES_CSV);
                parseMetamagicCSV(PRELOADED_METAMAGIC_CSV);
                
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
            };

            const handleResetDB = () => {
                if(confirm("Ripristinare DB?")) {
                    loadDefaultDatabases();
                    setShowImport(false);
                }
            };

            const handleImportCSV = () => {
                if (!csvText.trim()) return;
                try {
                    if (importType === 'features') parseFeaturesCSV(csvText);
                    else if (importType === 'feats') parseFeatsCSV(csvText);
                    setShowImport(false);
                    setCsvText('');
                } catch (e) { alert("Errore CSV"); }
            };

            // --- RENDER ---
            return (
                <div className="flex flex-col h-full bg-slate-950 text-slate-300">
                    <input type="file" ref={fileInputRef} style={{display: 'none'}} accept=".json" onChange={handleLoadSave} />

                    {/* MODAL IMPORTS */}
                    {showImport && (
                        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Icons.Upload /> Gestione Database CSV</h3>
                                <div className="flex gap-4 mb-4">
                                    <label className={`flex-1 p-3 rounded-lg border cursor-pointer text-center transition-all ${importType === 'features' ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                        <input type="radio" value="features" checked={importType === 'features'} onChange={() => setImportType('features')} className="hidden" /> Class Features
                                    </label>
                                    <label className={`flex-1 p-3 rounded-lg border cursor-pointer text-center transition-all ${importType === 'feats' ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                        <input type="radio" value="feats" checked={importType === 'feats'} onChange={() => setImportType('feats')} className="hidden" /> Talenti (Feats)
                                    </label>
                                </div>
                                <div className="mb-4 flex gap-2">
                                    <button onClick={() => csvFileInputRef.current.click()} className="flex-1 py-2 bg-slate-800 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-2"><Icons.FileText /> Carica File .CSV</button>
                                    <button onClick={handleResetDB} className="px-4 py-2 bg-red-900/30 border border-red-800 hover:bg-red-900/50 text-red-400 rounded-lg flex items-center gap-2" title="Ripristina Default"><Icons.Refresh /> Reset</button>
                                    <input type="file" accept=".csv" ref={csvFileInputRef} style={{ display: 'none' }} onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) { const r = new FileReader(); r.onload = (ev) => setCsvText(ev.target.result); r.readAsText(file); }
                                        e.target.value = '';
                                    }} />
                                </div>
                                <textarea className="flex-1 min-h-[150px] bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 focus:border-blue-500 outline-none resize-none" placeholder="Incolla qui il contenuto CSV..." value={csvText} onChange={(e) => setCsvText(e.target.value)}></textarea>
                                <div className="flex justify-end gap-3 mt-4">
                                    <button onClick={() => setShowImport(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">Annulla</button>
                                    <button onClick={handleImportCSV} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2"><Icons.Check /> Applica CSV</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL RENAME/DUPLICATE */}
                    {activeModal && (
                        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
                                <h3 className="text-xl font-bold text-white mb-4">
                                    {activeModal === 'rename' ? 'Rinomina Profilo' : 'Duplica Profilo'}
                                </h3>
                                <input 
                                    type="text" 
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none mb-4"
                                    autoFocus
                                />
                                <div className="flex justify-end gap-3">
                                    <button onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">Annulla</button>
                                    <button onClick={activeModal === 'rename' ? confirmRename : confirmDuplicate} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold">Conferma</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HEADER */}
                    <header className="bg-slate-900 border-b border-slate-800 p-4 shadow-md z-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-6">
                            <div className="flex justify-center md:justify-start">
                                <h1 className="text-xl font-bold text-white flex items-center gap-2 whitespace-nowrap">
                                    <span className="bg-blue-600 w-2 h-6 rounded-full"></span> D20 Revolution Builder <span className="text-xs text-slate-500 font-normal self-end mb-1">v0.062</span>
                                </h1>
                                {totalCPSpent > totalCPAvailable && (
                                    <div className="text-red-500 animate-pulse ml-3 w-6 h-6" title="CP Exceeded!"><Icons.AlertLarge /></div>
                                )}
                            </div>
                            
                            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                                <div className="relative flex items-center bg-slate-800 rounded-xl border-2 border-slate-600 p-1 shadow-lg hover:border-blue-500 transition-colors group">
                                    <div className="px-2 text-slate-400 group-hover:text-blue-400"><Icons.User /></div>
                                    <select value={currentProfile} onChange={(e) => setCurrentProfile(e.target.value)} className="bg-transparent text-lg text-white font-bold outline-none appearance-none py-1 pr-6 cursor-pointer min-w-[150px] text-center">
                                        {profiles.map(p => <option key={p} value={p} className="bg-slate-800">{p}</option>)}
                                    </select>
                                    <div className="flex items-center gap-1 border-l border-slate-600 pl-2 ml-1">
                                        <button onClick={openRenameModal} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400" title="Rinomina"><Icons.Edit /></button>
                                        <button onClick={openDuplicateModal} className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400" title="Duplica"><Icons.Copy /></button>
                                        <button onClick={handleCreateProfile} className="p-1.5 rounded hover:bg-green-900/30 text-slate-400 hover:text-green-400" title="Nuovo"><Icons.Plus /></button>
                                        <button onClick={handleDeleteProfile} className="p-1.5 rounded hover:bg-red-900/30 text-slate-400 hover:text-red-400" title="Elimina"><Icons.Trash /></button>
                                    </div>
                                </div>
                                
                                {/* CP WIDGET */}
                                <div className={`flex flex-col items-center bg-slate-800 rounded-lg border border-slate-700 px-3 py-1 shadow-lg transition-colors duration-300 ${totalCPSpent > totalCPAvailable ? 'border-red-500/50 bg-red-900/10 animate-pulse' : 'border-green-500/30'}`}>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Creation Points</span>
                                    <span className={`text-lg font-mono font-bold leading-none flex items-center gap-1 ${totalCPSpent > totalCPAvailable ? 'text-red-400' : 'text-green-400'}`}>
                                        {totalCPSpent} <span className="text-slate-600 text-sm">/</span> {totalCPAvailable}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-center md:justify-end gap-2 overflow-x-auto pb-1">
                                <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
                                    <button onClick={handleExportSummary} className="px-2 py-1.5 hover:bg-slate-700 text-purple-300 text-xs font-bold rounded flex items-center gap-1" title="Esporta riepilogo testuale (TXT)"><Icons.FileText /><span className="hidden sm:inline">TXT</span></button>
                                    <div className="w-px bg-slate-700 mx-1"></div>
                                    {/* TASTO PER CONDIVIDERE IL SINGOLO PG */}
                                    <button onClick={() => handleDownloadSave(true)} className="px-2 py-1.5 hover:bg-slate-700 text-blue-300 text-xs font-bold rounded flex items-center gap-1" title="Esporta file Personaggio (JSON) da condividere"><Icons.User /><Icons.Upload className="rotate-180" /> <span className="hidden sm:inline">Esporta PG</span></button>
                                    <button onClick={() => handleDownloadSave(false)} className="px-2 py-1.5 hover:bg-slate-700 text-green-300 text-xs font-bold rounded flex items-center gap-1" title="Scarica Backup Completo di tutti i dati"><Icons.Save /></button>
                                </div>
                                <button onClick={() => fileInputRef.current.click()} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded flex items-center gap-1 shadow shadow-slate-900/20"><Icons.FolderOpen /> Load</button>
                                <button onClick={() => { setShowImport(true); setCsvText(''); }} className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold rounded flex items-center gap-1 shadow shadow-indigo-900/20"><Icons.Upload /> DB</button>
                            </div>
                        </div>

                        {activeTab === 'features' && (
                            <div className="flex flex-col gap-3">
                                <div className="relative">
                                    <Icons.Search />
                                    <input type="text" placeholder={`Cerca tra ${db.length} abilità...`} className="w-full bg-slate-950 border border-slate-700 text-slate-200 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 transition-colors" value={search} onChange={(e) => setSearch(e.target.value)} style={{ position: 'relative', top: '-22px', left: '0' }} />
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar items-center">
                                    <button onClick={() => setShowSelectedOnly(!showSelectedOnly)} className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1 ${showSelectedOnly ? 'bg-green-600 text-white border-green-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>
                                        <Icons.Check /> Selezionati
                                    </button>
                                    <button onClick={() => setSelectedTags([])} className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1 ${selectedTags.length === 0 ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>Tutti</button>
                                    {classes.map(cls => (
                                        <button key={cls} onClick={() => toggleTag(cls)} className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1 ${selectedTags.includes(cls) ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>
                                            {cls} {selectedTags.includes(cls) && <Icons.X />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </header>

                    {/* VISTA 1: CLASS FEATURES */}
                    {activeTab === 'features' && (
                        <div className="flex-1 overflow-y-auto p-2 sm:p-4 custom-scrollbar">
                            <div className="space-y-1">
                                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <div className="col-span-1 text-center">Sel</div>
                                    <div className="col-span-3">Nome Feature</div>
                                    <div className="col-span-2">Classe</div>
                                    <div className="col-span-1 text-center">CP</div>
                                    <div className="col-span-1 text-center">Req</div>
                                    <div className="col-span-1 text-center">AP</div>
                                    <div className="col-span-2 text-left">Prerequisiti</div>
                                    <div className="col-span-1 text-right">Info</div>
                                </div>
                                {filteredData.map(feat => {
                                    // MODIFICA: Controllo 'isSelected' compatibile con oggetti
                                    const isSelected = charData.features.some(f => f.id === feat.id);
                                    
                                    const displayTags = feat.tag ? feat.tag.split(';').map(t => t.trim()) : [];
                                    const displayPrereqs = feat.pre && feat.pre !== '-' ? feat.pre.split(';').map(t => t.trim()).filter(Boolean) : [];
                                    let canSelect = true;
                                    let reqMsg = '';
                                    if (!isSelected && displayPrereqs.length > 0) {
                                        const unmet = displayPrereqs.filter(p => !checkPrereq(p));
                                        if (unmet.length > 0) { canSelect = false; reqMsg = `Missing: ${unmet.join(', ')}`; }
                                    }
                                    if (canSelect && !isSelected) {
                                        const classCheck = checkClassPrereq(feat);
                                        if (!classCheck.allowed) { canSelect = false; reqMsg = classCheck.msg; }
                                    }
                                    return (
                                        <div key={feat.id} onClick={() => toggleFeature(feat.id)} title={!canSelect && !isSelected ? reqMsg : ''}
                                            className={`group relative rounded-lg border transition-all duration-200 overflow-hidden ${isSelected ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)] cursor-pointer' : canSelect ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 hover:border-slate-700 cursor-pointer' : 'bg-slate-900/50 border-slate-800/50 opacity-50 cursor-not-allowed grayscale'}`}>
                                            <div className="p-3 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center">
                                                <div className="flex justify-between items-center sm:col-span-1 sm:justify-center mb-2 sm:mb-0">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : canSelect ? 'border-slate-600 bg-slate-950 group-hover:border-slate-400' : 'border-slate-700 bg-slate-900'}`}>{isSelected ? <Icons.Check /> : !canSelect && <Icons.Lock />}</div>
                                                    <span className="sm:hidden text-xs font-mono text-slate-500">{feat.tag}</span>
                                                </div>
                                                <div className="sm:col-span-3 mb-2 sm:mb-0">
                                                    <div className={`font-bold text-sm ${isSelected ? 'text-blue-100' : canSelect ? 'text-slate-200' : 'text-slate-500'}`}>{feat.name}</div>
                                                    <div className={`text-xs sm:hidden transition-all duration-300 ${isSelected ? 'whitespace-pre-wrap mt-2 text-slate-300 leading-relaxed' : 'truncate text-slate-500'}`}>{feat.desc}</div>
                                                    {!canSelect && !isSelected && <div className="text-[10px] text-red-500 font-bold mt-1">{reqMsg}</div>}
                                                    {feat.pre && feat.pre !== '-' && (
                                                        <div className="sm:hidden mt-1 flex flex-wrap gap-1">
                                                            {displayPrereqs.map((p, i) => <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${checkPrereq(p) ? 'text-green-400 bg-green-900/10 border-green-900/20' : 'text-red-400 bg-red-900/10 border-red-900/20'}`}>{p} {checkPrereq(p) && '✓'}</span>)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="hidden sm:block sm:col-span-2">
                                                    <div className="flex flex-wrap gap-1">{displayTags.map((t, i) => <span key={i} className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide bg-slate-800 text-slate-400 border border-slate-700">{t}</span>)}</div>
                                                </div>
                                                <div className="flex justify-between items-center sm:contents text-xs sm:text-sm">
                                                    <div className="sm:col-span-1 sm:text-center flex flex-col sm:block items-center"><span className="sm:hidden text-[10px] text-slate-600 uppercase mb-0.5">Costo</span><span className="font-mono font-bold text-yellow-500">{feat.cp}</span></div>
                                                    <div className="sm:col-span-1 sm:text-center flex flex-col sm:block items-center"><span className="sm:hidden text-[10px] text-slate-600 uppercase mb-0.5">Liv.</span><span className="font-mono text-slate-400">{feat.req}</span></div>
                                                    <div className="sm:col-span-1 sm:text-center flex flex-col sm:block items-center"><span className="sm:hidden text-[10px] text-slate-600 uppercase mb-0.5">Azione</span><span className="font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-[50px]">{feat.ap}</span></div>
                                                    <div className="hidden sm:block sm:col-span-2 text-xs text-slate-400">
                                                        {displayPrereqs.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">{displayPrereqs.map((p, i) => <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${checkPrereq(p) ? 'text-green-400 bg-green-900/20 border-green-900/30' : 'text-red-300 bg-red-900/10 border-red-900/20'}`}>{p} {checkPrereq(p) && '✓'}</span>)}</div>
                                                        ) : '-'}
                                                    </div>
                                                    <div className="hidden sm:flex sm:col-span-1 sm:justify-end text-slate-600 group-hover:text-slate-400"><Icons.Info /></div>
                                                </div>
                                                <div className={`hidden sm:block text-xs col-span-12 overflow-hidden transition-all duration-300 whitespace-pre-wrap ${isSelected ? 'mt-2 pt-2 border-t border-slate-800 opacity-100 h-auto text-slate-300 leading-relaxed' : 'opacity-0 h-0 group-hover:mt-2 group-hover:pt-2 group-hover:border-t group-hover:border-slate-800 group-hover:opacity-100 group-hover:h-auto text-slate-400'}`}>{feat.desc}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* VISTA 2: BASIC FEATURES */}
                    {activeTab === 'basic' && (
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex flex-col lg:flex-row gap-6">
                                
                                {/* COLONNA SINISTRA (1/3) */}
                                <div className="w-full lg:w-1/3 flex flex-col gap-6">
                                    
                                    {/* STAT GENERATOR */}
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 shadow-lg">
                                        <h3 className="text-lg font-bold text-blue-400 mb-2 flex items-center gap-2">
                                            <Icons.Chart /> Stat Generator
                                        </h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="text-xs text-slate-500 uppercase border-b border-slate-800">
                                                        <th className="p-2">Stat</th>
                                                        <th className="p-2">Base</th>
                                                        <th className="p-2 text-center">Costo</th>
                                                        <th className="p-2 text-center">Race</th>
                                                        <th className="p-2 text-center">Feat</th>
                                                        <th className="p-2 text-center">Increase</th>
                                                        <th className="p-2 text-center">Misc</th>
                                                        <th className="p-2 text-right text-white">Totale</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-sm divide-y divide-slate-800">
                                                    {Object.keys(charData.stats).map(key => (
                                                        <tr key={key} className="hover:bg-slate-800/50">
                                                            <td className="p-2 font-bold text-blue-400">{key}</td>
                                                            <td className="p-2">
                                                                <select 
                                                                    value={charData.stats[key].base} 
                                                                    onChange={(e) => handleStatChange(key, 'base', e.target.value)}
                                                                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white focus:border-blue-500 outline-none w-16"
                                                                >
                                                                    {[8,9,10,11,12,13,14,15].map(v => <option key={v} value={v}>{v}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="p-2 text-center font-mono text-slate-500">{POINT_BUY_COSTS[charData.stats[key].base]}</td>
                                                            <td className="p-2 text-center"><input type="number" className="w-12 bg-transparent border-b border-slate-700 text-center focus:border-blue-500 outline-none" value={charData.stats[key].race || ''} onChange={(e) => handleStatChange(key, 'race', e.target.value)} /></td>
                                                            <td className="p-2 text-center"><input type="number" className="w-12 bg-transparent border-b border-slate-700 text-center focus:border-blue-500 outline-none" value={charData.stats[key].feat || ''} onChange={(e) => handleStatChange(key, 'feat', e.target.value)} /></td>
                                                            <td className="p-2 text-center"><input type="number" className="w-12 bg-transparent border-b border-slate-700 text-center focus:border-blue-500 outline-none" value={charData.stats[key].ability || ''} onChange={(e) => handleStatChange(key, 'ability', e.target.value)} /></td>
                                                            <td className="p-2 text-center"><input type="number" className="w-12 bg-transparent border-b border-slate-700 text-center focus:border-blue-500 outline-none" value={charData.stats[key].misc || ''} onChange={(e) => handleStatChange(key, 'misc', e.target.value)} /></td>
                                                            <td className="p-2 text-right font-bold text-xl text-white">{calculateFinalScore(charData.stats[key])}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="border-t border-slate-800 font-bold text-xs">
                                                        <td className="p-2"></td>
                                                        <td className="p-2"></td>
                                                        <td className={`p-2 text-center font-mono ${bpUsed > 27 ? 'text-red-500' : 'text-green-400'}`}>
                                                            {bpUsed} / 27
                                                        </td>
                                                        <td className="p-2"></td>
                                                        <td className="p-2"></td>
                                                        <td className="p-2 text-center text-yellow-500">
                                                            {abilityCostCP} CP
                                                        </td>
                                                        <td className="p-2"></td>
                                                        <td className="p-2"></td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>

                                    {/* POWER & CLASS CARD */}
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 shadow-lg">
                                        <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
                                            <Icons.Zap /> Power & Class
                                        </h3>
                                        
                                        {/* SECTION 1: POWER */}
                                        <div className="mb-4">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                                                    <span className="text-sm text-slate-300">Character Level</span>
                                                    <select 
                                                        value={charData.charPower.level} 
                                                        onChange={(e) => handleCharPowerChange('level', parseInt(e.target.value))}
                                                        className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-white font-bold focus:border-blue-500 outline-none"
                                                    >
                                                        {Array.from({length: 40}, (_, i) => i + 1).map(lvl => (
                                                            <option key={lvl} value={lvl}>{lvl}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                
                                                <div className="flex justify-between items-center bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                                                    <span className="text-xs text-slate-300 truncate uppercase font-bold" title="Creation Points per level">CP / Level</span>
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={() => handleCharPowerChange('cpPerLevel', Math.max(0, (charData.charPower.cpPerLevel || 0) - 0.5))}
                                                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold flex items-center justify-center border border-slate-700 transition-colors"
                                                        >
                                                            -
                                                        </button>
                                                        <input 
                                                            type="number" 
                                                            step="0.5"
                                                            value={charData.charPower.cpPerLevel} 
                                                            onChange={(e) => handleCharPowerChange('cpPerLevel', parseFloat(e.target.value) || 0)}
                                                            className="w-12 bg-transparent text-center text-white font-bold outline-none appearance-none font-mono"
                                                        />
                                                        <button 
                                                            onClick={() => handleCharPowerChange('cpPerLevel', (charData.charPower.cpPerLevel || 0) + 0.5)}
                                                            className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold flex items-center justify-center border border-slate-700 transition-colors"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center pt-2 border-t border-slate-800 mt-2">
                                                <span className="text-sm font-bold text-slate-400 uppercase">Totale CP Disponibili</span>
                                                <span className="text-xl font-bold text-green-400 font-mono">{totalCPAvailable}</span>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-800 mb-4"></div>

                                        {/* SECTION 2: CLASSES */}
                                        <div className="space-y-3">
                                            {(charData.classes || []).map((clsItem, index) => {
                                                const profData = proficiencyMap[clsItem.className];
                                                const req = CLASS_REQUIREMENTS[clsItem.className];
                                                const currentStatValues = {
                                                    STR: calculateFinalScore(charData.stats.STR),
                                                    DEX: calculateFinalScore(charData.stats.DEX),
                                                    CON: calculateFinalScore(charData.stats.CON),
                                                    INT: calculateFinalScore(charData.stats.INT),
                                                    WIS: calculateFinalScore(charData.stats.WIS),
                                                    CHA: calculateFinalScore(charData.stats.CHA)
                                                };
                                                const isReqMet = req ? req.check(currentStatValues) : true;

                                                return (
                                                    <div key={index} className="bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                                                        <div className="flex gap-2 items-center mb-1">
                                                            <div className="w-full">
                                                                <select
                                                                    value={clsItem.className}
                                                                    onChange={(e) => updateClass(index, 'className', e.target.value)}
                                                                    className="bg-transparent text-white w-full focus:outline-none text-sm font-bold"
                                                                >
                                                                    <option value="" className="bg-slate-900">Seleziona Classe...</option>
                                                                    {FIXED_CLASSES_LIST.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                                                                </select>
                                                                {clsItem.className && req && (
                                                                    <div className={`text-[10px] uppercase font-bold mt-1 ${isReqMet ? 'text-green-500' : 'text-red-500'}`}>
                                                                        Req: {req.text} {isReqMet ? '✓' : '✕'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="h-6 w-px bg-slate-700"></div>
                                                            <select
                                                                value={clsItem.level}
                                                                onChange={(e) => updateClass(index, 'level', parseInt(e.target.value))}
                                                                className="bg-transparent text-white w-25 text-center focus:outline-none text-sm font-mono"
                                                            >
                                                                {Array.from({length: 40}, (_, i) => i + 1).map(l => <option key={l} value={l} className="bg-slate-900">Lvl {l}</option>)}
                                                            </select>
                                                            <div className="flex items-center justify-center px-2 bg-yellow-900/20 border border-yellow-700/50 rounded text-xs font-mono font-bold text-yellow-500 min-w-[3rem]">
                                                                {clsItem.level}
                                                            </div>
                                                            
                                                            <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer select-none ml-2">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={clsItem.showProficiency || false} 
                                                                    onChange={() => toggleClassProficiency(index)}
                                                                    className="accent-blue-500 w-3 h-3 rounded"
                                                                />
                                                                Prof
                                                                {profData && (
                                                                    <span className={`${clsItem.showProficiency ? 'text-yellow-500 font-bold' : 'text-slate-600'} text-[10px] ml-1 whitespace-nowrap`}>
                                                                        ({profData.cost} CP)
                                                                    </span>
                                                                )}
                                                            </label>

                                                            <button onClick={() => removeClass(index)} className="text-slate-500 hover:text-red-400 p-1 hover:bg-slate-800 rounded transition-colors">
                                                                <Icons.Trash />
                                                            </button>
                                                        </div>
                                                        
                                                        {/* PROFICIENCY DETAILS */}
                                                        {clsItem.showProficiency && profData && (
                                                            <div className="mt-2 p-2 bg-slate-800/50 rounded border border-slate-700 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed animate-in slide-in-from-top-1">
                                                                {profData.desc}
                                                            </div>
                                                        )}
                                                        {clsItem.showProficiency && !profData && clsItem.className && (
                                                            <div className="mt-2 p-2 bg-slate-800/50 rounded border border-slate-700 text-xs text-slate-500 italic">
                                                                Nessuna informazione sulla competenza disponibile per questa classe.
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            <button
                                                onClick={addClass}
                                                className="w-full py-2 border-2 border-dashed border-slate-700 text-slate-500 rounded-lg hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                                            >
                                                <Icons.Plus /> Aggiungi Classe
                                            </button>
                                        </div>
                                    </div>

                                    {/* HIT POINTS CARD */}
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-lg animate-in slide-in-from-bottom-2">
                                        <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                                            <Icons.Heart /> Hit Points
                                        </h3>
                                        {hpClassesForDisplay.length === 0 ? (
                                            <div className="text-center py-4 text-slate-500 text-sm italic">Seleziona una classe e abilita la Proficienza per gestire gli HP.</div>
                                        ) : (
                                            <div className="space-y-4">
                                                {hpClassesForDisplay.map((cls, idx) => {
                                                    const baseHp = getHpPerLevel(cls.className);
                                                    const currentHp = cls.selectedHp || baseHp;
                                                    const upgradeCost = calculateSingleHpCost(baseHp, currentHp);
                                                    const realIndex = charData.classes.indexOf(cls);

                                                    return (
                                                        <div key={idx} className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div className="font-bold text-slate-200 text-sm">{cls.className || "Classe non selezionata"} <span className="text-slate-500 font-normal ml-1">(Lv. {cls.level})</span></div>
                                                                <div className="text-xs text-slate-400">
                                                                    Base: <span className="text-yellow-500 font-bold">{baseHp} HP/Lv</span>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700">
                                                                <span className="text-xs text-slate-400 uppercase font-bold">HP per Livello</span>
                                                                <div className="flex items-center gap-3">
                                                                    <button 
                                                                        onClick={() => updateClassHp(realIndex, Math.max(baseHp, currentHp - 1))}
                                                                        disabled={currentHp <= baseHp}
                                                                        className={`w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 transition-colors ${currentHp <= baseHp ? 'opacity-50 cursor-not-allowed' : 'text-white'}`}
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className={`text-lg font-bold w-6 text-center ${currentHp > baseHp ? 'text-yellow-400' : 'text-white'}`}>
                                                                        {currentHp}
                                                                    </span>
                                                                    <button 
                                                                        onClick={() => updateClassHp(realIndex, Math.min(10, currentHp + 1))}
                                                                        disabled={currentHp >= 10}
                                                                        className={`w-6 h-6 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600 transition-colors ${currentHp >= 10 ? 'opacity-50 cursor-not-allowed' : 'text-white'}`}
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex justify-between items-center mt-2 text-xs">
                                                                <span className="text-slate-500">Costo Upgrade (Una tantum):</span>
                                                                <span className={`font-bold ${upgradeCost > 0 ? 'text-yellow-500' : 'text-slate-600'}`}>
                                                                    {upgradeCost} CP
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div className="border-t border-slate-700 pt-3 mt-2 flex justify-end items-center">
                                                    <div className="text-right">
                                                        <div className="text-xs text-slate-500 uppercase font-bold">Total Hit Points</div>
                                                        <div className="text-2xl font-bold text-red-500">{totalHP}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* SAVING THROWS CARD */}
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-lg animate-in slide-in-from-bottom-3">
                                        <h3 className="text-lg font-bold text-green-400 mb-3 flex items-center gap-2">
                                            <Icons.Shield /> Saving Throws
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.keys(charData.stats).map(stat => {
                                                const isProficient = charData.savingThrows?.[stat] || false;
                                                const finalScore = calculateFinalScore(charData.stats[stat]);
                                                const mod = getAbilityMod(finalScore);
                                                const pb = getProficiencyBonus(charData.charPower.level);
                                                const total = mod + (isProficient ? pb : 0);
                                                return (
                                                    <div key={stat} className={`flex justify-between items-center p-2 rounded border transition-colors ${isProficient ? 'bg-green-900/20 border-green-700/50' : 'bg-slate-950/50 border-slate-800'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isProficient} 
                                                                onChange={() => toggleSavingThrow(stat)}
                                                                className="accent-green-500 w-4 h-4 rounded cursor-pointer"
                                                            />
                                                            <span className={`font-bold text-sm ${isProficient ? 'text-green-400' : 'text-slate-400'}`}>{stat}</span>
                                                        </div>
                                                        <span className={`font-mono font-bold ${total > 0 ? 'text-white' : total < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                            {total >= 0 ? '+' : ''}{total}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* COLONNA DESTRA (2/3) - FEATS & SKILLS */}
                                <div className="w-full lg:w-2/3 flex flex-col gap-6">
                                    {/* FEATS SECTION */}
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg">
                                        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                                             <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                                                <Icons.Feather /> Character Feats
                                            </h3>
                                            <div className="bg-slate-800 px-3 py-1 rounded text-xs font-mono text-slate-400">
                                                CP Feats: <span className="text-yellow-400 font-bold">{totalCPFeats} CP</span>
                                            </div>
                                        </div>

                                        {/* Add Feat Dropdown */}
                                        <div className="flex gap-2 mb-6">
                                            <div className="relative flex-1 bg-slate-950/50 border border-slate-700 rounded-lg flex items-center px-3 py-2">
                                                <select 
                                                    value={featSelection} 
                                                    onChange={(e) => setFeatSelection(e.target.value)}
                                                    className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer"
                                                >
                                                    <option value="" className="bg-slate-900">Seleziona un Talento da aggiungere...</option>
                                                    {availableFeats.map(f => (
                                                        <option key={f.id} value={f.id} className="bg-slate-900">
                                                            {f.name} ({f.cost} CP)
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={addFeat}
                                                disabled={!featSelection}
                                                className={`px-4 py-2 rounded-lg font-bold transition-colors ${featSelection ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                            >
                                                Aggiungi
                                            </button>
                                        </div>

                                        {/* Feats List */}
                                        {(charData.feats || []).length === 0 ? (
                                            <div className="text-center py-12 text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
                                                Nessun talento selezionato.
                                            </div>
                                        ) : (
                                            /* MODIFICA: Rimosso max-h-[400px], overflow-y-auto, custom-scrollbar e pr-2 */
                                            <div className="space-y-3">
                                                {charData.feats.map((feat, idx) => (
                                                    <div key={`${feat.id}-${idx}`} className="bg-slate-950/80 border border-slate-700 rounded-lg p-4 relative group hover:border-blue-500/50 transition-all">
                                                        <button 
                                                            onClick={() => removeFeat(idx)}
                                                            className="absolute top-3 right-3 text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition-colors"
                                                            title="Rimuovi Talento"
                                                        >
                                                            <Icons.Trash />
                                                        </button>
                                                        <div className="flex justify-between items-start pr-8 mb-2">
                                                            <h4 className="font-bold text-white text-lg">{feat.name}</h4>
                                                            <div className="flex items-center gap-3">
                                                                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={feat.isBonus || false} 
                                                                        onChange={() => toggleBonusFeat(idx)}
                                                                        className="accent-blue-500 w-3 h-3 rounded"
                                                                    />
                                                                    Bonus Feat
                                                                </label>
                                                                <span className={`${feat.isBonus ? 'bg-slate-800 text-slate-500 line-through' : 'bg-slate-900 text-yellow-500'} text-xs font-bold px-2 py-1 rounded border border-slate-800 whitespace-nowrap`}>
                                                                    {feat.cost} CP
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-slate-500 mb-2 flex gap-3">
                                                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">Prereq: <span className="text-slate-300">{feat.prereq}</span></span>
                                                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1"><Icons.Zap /> {feat.action}</span>
                                                        </div>
                                                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                            {feat.desc}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* SKILLS SECTION */}
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg">
                                        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                                             <div className="flex flex-col">
                                                <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                                                    <Icons.Book /> Skills
                                                </h3>
                                                <span className="text-xs text-slate-500 mt-1">1 CP per skill (Prima skill gratis). Free Skills costano 0 CP.</span>
                                             </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="bg-slate-800 px-3 py-1 rounded text-xs font-mono text-slate-400">
                                                    CP Skills: <span className="text-yellow-400 font-bold">{totalSkillCost} CP</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono">
                                                    Prof. Bonus: <span className="text-green-400 font-bold">+{getProficiencyBonus(charData.charPower.level)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="text-xs text-slate-500 uppercase border-b border-slate-800">
                                                        <th className="p-2 text-center w-10">Prof</th>
                                                        <th className="p-2">Skill Name</th>
                                                        <th className="p-2 text-center w-16">Stat</th>
                                                        <th className="p-2 text-center w-20">Free</th>
                                                        <th className="p-2 text-center w-16">Expert</th>
                                                        <th className="p-2 text-right w-16">Bonus</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-sm divide-y divide-slate-800">
                                                    {SKILLS_DATA.map(skill => {
                                                        const state = charData.skills[skill.name] || { isProficient: false, isClassSkill: false, isExpert: false };
                                                        const isProficient = state.isProficient;
                                                        const isClassSkill = state.isClassSkill;
                                                        const isExpert = state.isExpert;
                                                        
                                                        const statValue = calculateFinalScore(charData.stats[skill.stat]);
                                                        const statMod = getAbilityMod(statValue);
                                                        const pb = getProficiencyBonus(charData.charPower.level);
                                                        
                                                        const expertMultiplier = isExpert ? 2 : 1;
                                                        const totalBonus = statMod + (isProficient ? pb * expertMultiplier : 0);
                                                        const bonusSign = totalBonus >= 0 ? '+' : '';

                                                        return (
                                                            <tr key={skill.name} className={`hover:bg-slate-800/50 transition-colors ${isProficient ? 'bg-blue-900/10' : ''}`}>
                                                                <td className="p-2 text-center">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isProficient} 
                                                                        onChange={() => toggleSkill(skill.name, 'prof')}
                                                                        className="accent-blue-500 w-4 h-4 rounded cursor-pointer"
                                                                    />
                                                                </td>
                                                                <td className={`p-2 font-medium ${isProficient ? 'text-white' : 'text-slate-400'}`}>
                                                                    {skill.name}
                                                                </td>
                                                                <td className="p-2 text-center text-xs text-slate-500 font-mono">
                                                                    {skill.stat}
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isClassSkill} 
                                                                        disabled={!isProficient}
                                                                        onChange={() => toggleSkill(skill.name, 'class')}
                                                                        className={`w-4 h-4 rounded cursor-pointer ${!isProficient ? 'opacity-30 cursor-not-allowed' : 'accent-yellow-500'}`}
                                                                        title={!isProficient ? "Abilita la competenza prima" : "Rende questa abilità di classe (Costo 0)"}
                                                                    />
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isExpert} 
                                                                        disabled={!isProficient}
                                                                        onChange={() => toggleSkill(skill.name, 'expert')}
                                                                        className={`w-4 h-4 rounded cursor-pointer ${!isProficient ? 'opacity-30 cursor-not-allowed' : 'accent-purple-500'}`}
                                                                        title={!isProficient ? "Abilita la competenza prima" : "Raddoppia il Bonus di Competenza"}
                                                                    />
                                                                </td>
                                                                <td className="p-2 text-right">
                                                                    <span className={`font-bold font-mono ${totalBonus > 0 ? 'text-green-400' : totalBonus < 0 ? 'text-red-400' : 'text-slate-500'}`}>
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

                    {/* VISTA 4: COMBAT & MAGIC (NEW) */}
                    {activeTab === 'combat_magic' && (
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex flex-col lg:flex-row gap-6 lg:h-full">
                                {/* LEFT COLUMN (1/3) */}
                                <div className="w-full lg:w-1/3 flex flex-col gap-6">
                                    
                                    {/* FIGHTING STYLE */}
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-lg flex-1">
                                        <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                <span className="bg-red-600 w-1.5 h-6 rounded-full"></span> Fighting Style
                                            </h3>
                                            <div className="text-xs bg-slate-800 px-2 py-1 rounded text-yellow-500 font-mono font-bold">
                                                {charData.fightingStyles.length * 3} CP
                                            </div>
                                        </div>
                                        {/* Dropdown Selection */}
                                        <div className="flex gap-2 mb-4">
                                            <div className="relative flex-1 bg-slate-950/50 border border-slate-700 rounded-lg flex items-center px-3 py-2">
                                                <select value={fightingStyleSelection} onChange={(e) => setFightingStyleSelection(e.target.value)} 
                                                    className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer text-xs" >
                                                    <option value="" className="bg-slate-900">Seleziona Stile...</option>
                                                    {availableFightingStyles.map(s => (
                                                        <option key={s.id} value={s.id} className="bg-slate-900">{s.name} (3 CP)</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"><Icons.Filter /></div>
                                            </div>
                                            <button onClick={addFightingStyle} disabled={!fightingStyleSelection} className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors ${fightingStyleSelection ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} >
                                                Aggiungi
                                            </button>
                                        </div>
                                        {/* Selected Styles List */}
                                        <div className="space-y-3">
                                            {charData.fightingStyles.map((item, idx) => {
                                                // FIX: Supporta sia oggetti (nuovi) che stringhe (vecchi)
                                                const style = typeof item === 'object' ? item : fightingStylesDb.find(s => s.id === item);
                                                if (!style) return null;
                                                return (
                                                    <div key={`${style.id}-${idx}`} className="bg-slate-950/80 border border-slate-700 rounded-lg p-3 relative group hover:border-red-500/30 transition-all">
                                                        <button onClick={() => removeFightingStyle(style.id)} className="absolute top-2 right-2 text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition-colors" title="Rimuovi Stile"><Icons.Trash /></button>
                                                        <div className="flex justify-between items-start pr-6 mb-1">
                                                            <div className="font-bold text-sm text-white">{style.name}</div>
                                                            {style.action && style.action !== 'None' && <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700 uppercase tracking-wide">{style.action}</span>}
                                                        </div>
                                                        <div className="text-xs text-yellow-600 font-bold mb-1">Costo: 3 CP</div>
                                                        <div className="text-xs text-slate-400 leading-relaxed">{style.desc}</div>
                                                    </div>
                                                );
                                            })}
                                            {charData.fightingStyles.length === 0 && <div className="text-slate-500 text-xs italic text-center p-2 border border-dashed border-slate-800 rounded">Nessuno stile selezionato.</div>}
                                        </div>
                                    </div>

                                    {/* CUNNING STRIKE */}
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-lg flex-1">
                                        <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                <span className="bg-yellow-600 w-1.5 h-6 rounded-full"></span> Cunning Strike
                                            </h3>
                                            <div className="text-xs bg-slate-800 px-2 py-1 rounded text-yellow-500 font-mono font-bold">
                                                {charData.cunningStrikes.length * 2} CP
                                            </div>
                                        </div>
                                        {/* Dropdown Selection */}
                                        <div className="flex gap-2 mb-4">
                                            <div className="relative flex-1 bg-slate-950/50 border border-slate-700 rounded-lg flex items-center px-3 py-2">
                                                <select value={cunningStrikeSelection} onChange={(e) => setCunningStrikeSelection(e.target.value)} 
                                                    className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer text-xs" >
                                                    <option value="" className="bg-slate-900">Seleziona Strike...</option>
                                                    {availableCunningStrikes.map(s => (
                                                        <option key={s.id} value={s.id} className="bg-slate-900">{s.name} (2 CP)</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"><Icons.Filter /></div>
                                            </div>
                                            <button onClick={addCunningStrike} disabled={!cunningStrikeSelection} className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors ${cunningStrikeSelection ? 'bg-yellow-600 text-white hover:bg-yellow-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} >
                                                Aggiungi
                                            </button>
                                        </div>
                                        {/* Selected Cunning Strikes List */}
                                        <div className="space-y-3">
                                            {charData.cunningStrikes.map((item, idx) => {
                                                // FIX: Supporta sia oggetti (nuovi) che stringhe (vecchi)
                                                const strike = typeof item === 'object' ? item : cunningStrikesDb.find(s => s.id === item);
                                                if (!strike) return null;
                                                return (
                                                    <div key={`${strike.id}-${idx}`} className="bg-slate-950/80 border border-slate-700 rounded-lg p-3 relative group hover:border-yellow-500/30 transition-all">
                                                        <button onClick={() => removeCunningStrike(strike.id)} className="absolute top-2 right-2 text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition-colors" title="Rimuovi Strike"><Icons.Trash /></button>
                                                        <div className="flex justify-between items-start pr-6 mb-1">
                                                            <div className="font-bold text-sm text-white">{strike.name}</div>
                                                            {strike.costDice && strike.costDice !== '-' && <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700 uppercase tracking-wide">Cost: {strike.costDice}</span>}
                                                        </div>
                                                        <div className="text-xs text-yellow-600 font-bold mb-1">Costo: 2 CP</div>
                                                        <div className="text-xs text-slate-400 leading-relaxed">{strike.desc}</div>
                                                    </div>
                                                );
                                            })}
                                            {charData.cunningStrikes.length === 0 && <div className="text-slate-500 text-xs italic text-center p-2 border border-dashed border-slate-800 rounded">Nessun Cunning Strike selezionato.</div>}
                                        </div>
                                    </div>

                                    {/* METAMAGIC ADEPT */}
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-lg flex-1">
                                        <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                <span className="bg-purple-600 w-1.5 h-6 rounded-full"></span> Metamagic Adept
                                            </h3>
                                            <div className="text-xs bg-slate-800 px-2 py-1 rounded text-yellow-500 font-mono font-bold">
                                                {totalCPMetamagic} CP
                                            </div>
                                        </div>
                                        {/* Dropdown Selection */}
                                        <div className="flex gap-2 mb-4">
                                            <div className="relative flex-1 bg-slate-950/50 border border-slate-700 rounded-lg flex items-center px-3 py-2">
                                                <select value={metamagicSelection} onChange={(e) => setMetamagicSelection(e.target.value)} 
                                                    className="bg-transparent w-full text-white outline-none appearance-none cursor-pointer text-xs" >
                                                    <option value="" className="bg-slate-900">Seleziona Metamagic...</option>
                                                    {availableMetamagic.map(s => (
                                                        <option key={s.id} value={s.id} className="bg-slate-900">{s.name} (2 CP)</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500"><Icons.Filter /></div>
                                            </div>
                                            <button onClick={addMetamagic} disabled={!metamagicSelection} className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors ${metamagicSelection ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} >
                                                Aggiungi
                                            </button>
                                        </div>
                                        {/* Selected Metamagic List */}
                                        <div className="space-y-3">
                                            {charData.metamagic.map((item, idx) => {
                                                // FIX: Supporta oggetti completi
                                                const mm = typeof item === 'object' ? item : metamagicDb.find(m => m.id === item);
                                                const isSorcerer = typeof item === 'object' ? item.isSorcerer : false;
                                                const itemId = mm ? mm.id : idx;
                                                
                                                if (!mm) return null;

                                                return (
                                                    <div key={`${itemId}-${idx}`} className={`bg-slate-950/80 border rounded-lg p-3 relative group transition-all ${isSorcerer ? 'border-purple-500/50 bg-purple-900/10' : 'border-slate-700 hover:border-purple-500/30'}`}>
                                                        <button onClick={() => removeMetamagic(itemId)} className="absolute top-2 right-2 text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition-colors" title="Rimuovi Metamagic"><Icons.Trash /></button>
                                                        <div className="flex justify-between items-start pr-6 mb-1">
                                                            <div className="font-bold text-sm text-white">{mm.name}</div>
                                                            {mm.spCost && mm.spCost !== '-' && <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700 uppercase tracking-wide">Cost: {mm.spCost}</span>}
                                                        </div>
                                                        {/* Sorcerer Checkbox & Cost */}
                                                        <div className="flex items-center justify-between mb-2 mt-2 bg-slate-900/50 p-1.5 rounded border border-slate-800">
                                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                                <input type="checkbox" checked={isSorcerer} onChange={() => toggleSorcererMetamagic(itemId)} className="accent-purple-500 w-3.5 h-3.5 rounded" />
                                                                <span className={`text-xs font-bold ${isSorcerer ? 'text-purple-300' : 'text-slate-500'}`}>Sorcerer</span>
                                                            </label>
                                                            <div className={`text-xs font-bold ${isSorcerer ? 'text-slate-500 line-through' : 'text-yellow-500'}`}>
                                                                {isSorcerer ? '0 CP' : '2 CP'}
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-slate-400 leading-relaxed">{mm.desc}</div>
                                                    </div>
                                                );
                                            })}
                                            {charData.metamagic.length === 0 && <div className="text-slate-500 text-xs italic text-center p-2 border border-dashed border-slate-800 rounded">Nessun Metamagic selezionato.</div>}
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN (2/3) */}
                                {/* MODIFICA: Aggiunto 'min-h-[850px]' per forzare l'altezza su mobile */}
                                <div className="w-full lg:w-2/3 flex flex-col min-h-[850px] lg:h-full">
                                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-lg h-full flex flex-col overflow-hidden">
                                        <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2 flex-shrink-0">
                                            <Icons.Zap /> Magic
                                        </h3>
                                        
                                        {/* Magic Options Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 flex-shrink-0">
                                            {/* Extra Spell Known */}
                                            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
                                                <span className="text-xs text-slate-400 font-bold uppercase mb-2">Extra Spells Known</span>
                                                <div className="flex items-center gap-2">
                                                     <button onClick={() => handleMagicChange('extraSpells', Math.max(0, (charData.magic.extraSpells || 0) - 1))} className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center">-</button>
                                                     <span className="text-xl font-mono font-bold text-white w-8">{charData.magic.extraSpells || 0}</span>
                                                     <button onClick={() => handleMagicChange('extraSpells', (charData.magic.extraSpells || 0) + 1)} className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center">+</button>
                                                </div>
                                                <span className="text-[10px] text-yellow-500 mt-2 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">Costo: {charData.magic.extraSpells || 0} CP</span>
                                            </div>

                                            {/* Extra Spell Slot */}
                                            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
                                                <span className="text-xs text-slate-400 font-bold uppercase mb-2">Extra Slots / Lvl</span>
                                                <div className="flex items-center gap-2">
                                                     <button onClick={() => handleMagicChange('extraSlots', Math.max(0, (charData.magic.extraSlots || 0) - 1))} className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center" disabled={(charData.magic.extraSlots || 0) <= 0}>-</button>
                                                     <span className="text-xl font-mono font-bold text-white w-8">{charData.magic.extraSlots || 0}</span>
                                                     <button onClick={() => handleMagicChange('extraSlots', Math.min(3, (charData.magic.extraSlots || 0) + 1))} className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center" disabled={(charData.magic.extraSlots || 0) >= 3}>+</button>
                                                </div>
                                                <span className="text-[10px] text-yellow-500 mt-2 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">Costo: {(charData.magic.extraSlots || 0) * 10} CP</span>
                                            </div>

                                            {/* Slot as Mana */}
                                            <div onClick={() => handleMagicChange('slotAsMana', !charData.magic.slotAsMana)} className={`cursor-pointer p-3 rounded-lg border flex flex-col items-center justify-center text-center transition-all ${charData.magic.slotAsMana ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-950/50 border-slate-700 hover:border-slate-600'}`}>
                                                <span className="text-xs text-slate-400 font-bold uppercase mb-2">Slot as Mana</span>
                                                <div className={`w-8 h-8 rounded border-2 flex items-center justify-center transition-colors mb-1 ${charData.magic.slotAsMana ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-600 bg-slate-900'}`}>
                                                    {charData.magic.slotAsMana && <Icons.Check />}
                                                </div>
                                                <span className="text-[10px] text-yellow-500 mt-1 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">Costo: {charData.magic.slotAsMana ? 10 : 0} CP</span>
                                            </div>
                                        </div>

                                        {/* New Split Row for Spellcasting (FLEX GROW FIX) */}
                                        <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
                                            {/* Left Column: Spellcasting Selection */}
                                            <div className="w-full md:w-1/2 bg-slate-950/30 border border-slate-700 rounded-lg p-4 flex flex-col h-full overflow-hidden">
                                                <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider flex items-center gap-2 flex-shrink-0">
                                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Lancio Incantesimi
                                                </h4>
                                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                                                    {SPELLCASTING_DATA.map((sc, idx) => {
                                                        const isSelected = (charData.spellcasting || []).includes(sc.name);
                                                        
                                                        // Logica Prerequisiti
                                                        let reqClass = sc.name.split(', ')[1]; 
                                                        if (reqClass === 'Eldritch Knight') reqClass = 'Fighter';
                                                        if (reqClass === 'Arcane Trickster') reqClass = 'Rogue';
                                                        
                                                        const hasPrereq = charData.classes.some(c => c.className === reqClass && c.level > 0);

                                                        return (
                                                            <div 
                                                                key={idx} 
                                                                onClick={() => {
                                                                    if (hasPrereq) toggleSpellcasting(sc.name);
                                                                }}
                                                                className={`relative flex items-center justify-between p-2 rounded border transition-all 
                                                                    ${!hasPrereq 
                                                                        ? 'bg-slate-900/50 border-slate-800 opacity-50 cursor-not-allowed' 
                                                                        : isSelected 
                                                                            ? 'bg-blue-900/20 border-blue-500/50 cursor-pointer' 
                                                                            : 'bg-slate-900 border-slate-800 hover:border-slate-600 cursor-pointer'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors 
                                                                        ${!hasPrereq 
                                                                            ? 'border-slate-700 bg-slate-900 text-slate-600'
                                                                            : isSelected 
                                                                                ? 'bg-blue-600 border-blue-600' 
                                                                                : 'border-slate-600 bg-slate-950'
                                                                        }`}>
                                                                        {hasPrereq ? (isSelected && <Icons.Check />) : <Icons.Lock />}
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className={`text-xs font-bold ${isSelected && hasPrereq ? 'text-white' : 'text-slate-400'}`}>
                                                                            {sc.name.replace(/Spell\s?casting, /i, '')}
                                                                        </span>
                                                                        {!hasPrereq && (
                                                                            <span className="text-[9px] text-red-500 font-bold uppercase">
                                                                                Richiede {reqClass}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border 
                                                                    ${hasPrereq ? 'text-yellow-500 bg-slate-950 border-slate-800' : 'text-slate-600 bg-slate-900 border-slate-800'}`}>
                                                                    {sc.cost} CP
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Right Column: Caster Levels Selection */}
                                            <div className="w-full md:w-1/2 bg-slate-950/30 border border-slate-700 rounded-lg p-4 flex flex-col h-full overflow-hidden">
                                                <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider flex items-center gap-2 flex-shrink-0">
                                                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span> Caster Levels
                                                </h4>

                                                {/* HEADER: TOTAL SPELLCASTER LEVEL */}
                                                <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 mb-3 flex justify-between items-center shadow-sm flex-shrink-0">
                                                    <div>
                                                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Level</span>
                                                        <span className="text-xl font-bold text-purple-400 font-mono">
                                                            {(charData.magic.casterSlots || []).reduce((acc, slot, idx) => {
                                                                if (!slot || !slot.active) return acc;
                                                                return acc + calculateCasterLevel(CASTER_SLOTS_CONFIG[idx].type, slot.level);
                                                            }, 0)}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Costo Totale</span>
                                                        <span className="text-lg font-bold text-yellow-500 font-mono">
                                                            {(charData.magic.casterSlots || []).reduce((acc, slot, idx) => {
                                                                if (!slot || !slot.active) return acc;
                                                                return acc + calculateCasterLevel(CASTER_SLOTS_CONFIG[idx].type, slot.level);
                                                            }, 0)} CP
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                                                    {CASTER_SLOTS_CONFIG.map((config, idx) => {
                                                        const slotData = (charData.magic.casterSlots && charData.magic.casterSlots[idx]) 
                                                            ? charData.magic.casterSlots[idx] 
                                                            : { active: false, level: 1 };
                                                        
                                                        const resultLevel = calculateCasterLevel(config.type, slotData.level);

                                                        return (
                                                            <div key={idx} className={`p-2 rounded border transition-all ${slotData.active ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-900 border-slate-800'}`}>
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={slotData.active}
                                                                        onChange={() => handleCasterSlotChange(idx, 'active')}
                                                                        className="accent-purple-500 w-4 h-4 cursor-pointer"
                                                                    />
                                                                    <span className={`text-xs font-bold flex-1 ${slotData.active ? 'text-white' : 'text-slate-400'}`}>
                                                                        {config.label}
                                                                    </span>
                                                                </div>

                                                                {slotData.active && (
                                                                    <div className="flex items-center justify-between pl-7">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] text-slate-500 uppercase">Livello</span>
                                                                            <select 
                                                                                value={slotData.level}
                                                                                onChange={(e) => handleCasterSlotChange(idx, 'level', e.target.value)}
                                                                                className="bg-slate-950 border border-slate-700 rounded text-xs text-white px-1 py-0.5 outline-none focus:border-purple-500"
                                                                            >
                                                                                {Array.from({length: 20}, (_, i) => i + 1).map(l => (
                                                                                    <option key={l} value={l}>{l}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                        
                                                                        <div className="text-right">
                                                                            <span className="text-[9px] text-slate-500 block uppercase">Caster Lv</span>
                                                                            <span className="text-sm font-mono font-bold text-purple-400">{resultLevel}</span>
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

                    {/* TABS BOTTOM */}
                    <div 
                        className="bg-slate-900 border-t border-slate-800 flex justify-around items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex-shrink-0"
                        style={{ 
                            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                            height: 'calc(4rem + env(safe-area-inset-bottom, 0px))'
                        }}
                    >
                        <button onClick={() => setActiveTab('basic')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${activeTab === 'basic' ? 'text-blue-400 bg-slate-800/50 border-t-2 border-blue-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}>
                            <Icons.Calculator /><span className="text-[10px] font-medium mt-1">Basic Features</span>
                        </button>
                        <div className="h-8 w-px bg-slate-800"></div>
                        <button onClick={() => setActiveTab('features')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${activeTab === 'features' ? 'text-blue-400 bg-slate-800/50 border-t-2 border-blue-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}>
                            <Icons.List /><span className="text-[10px] font-medium mt-1">Class Features</span>
                        </button>
                        <div className="h-8 w-px bg-slate-800"></div>
                        <button onClick={() => setActiveTab('combat_magic')} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${activeTab === 'combat_magic' ? 'text-blue-400 bg-slate-800/50 border-t-2 border-blue-500' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}`}>
                            <Icons.Sword /><span className="text-[10px] font-medium mt-1">Combat & Magic</span>
                        </button>
                    </div>
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
