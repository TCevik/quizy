import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@8/+esm';
import Toast from './toast.js';

const DB_NAME = 'QuizyDB';
const DB_VERSION = 1;
const STORE_NAME = 'sets';

function normalizeId(id) {
    if (typeof id === 'number') return id;
    const n = Number(id);
    return Number.isFinite(n) ? n : id;
}

function sanitizeSharedSet(fullSet) {
    return {
        id: fullSet.id,
        user_id: fullSet.user_id,
        title: fullSet.title,
        description: fullSet.description,
        folder: fullSet.folder,
        type: fullSet.type,
        card_count: fullSet.card_count,
        visibility: fullSet.visibility,
        created_at: fullSet.created_at,
        updated_at: fullSet.updated_at,
        cards: fullSet.cards
    };
}

async function getDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        }
    });
}

export async function getLocalSets() {
    const db = await getDB();
    return db.getAll(STORE_NAME);
}

export async function getLocalSet(id) {
    const db = await getDB();
    return db.get(STORE_NAME, normalizeId(id));
}

export async function saveLocalSets(sets) {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    for (const set of sets) {
        const existing = await tx.store.get(normalizeId(set.id));
        if (existing && existing.cards && !set.cards) {
            set.cards = existing.cards;
        }
        await tx.store.put(set);
    }
    await tx.done;
}

export async function saveLocalSet(set) {
    const db = await getDB();
    const existing = await db.get(STORE_NAME, normalizeId(set.id));
    if (existing && existing.cards && !set.cards) {
        set.cards = existing.cards;
    }
    await db.put(STORE_NAME, set);
}

export async function deleteLocalSet(id) {
    const db = await getDB();
    await db.delete(STORE_NAME, normalizeId(id));
}

export async function syncSets(supabase, userId) {
    const localSets = await getLocalSets();
    
    if (navigator.onLine) {
        try {
            const { data: remoteSets, error } = await supabase
                .from('Sets')
                .select('id, updated_at')
                .eq('user_id', userId);

            if (!error && remoteSets) {
                const remoteIds = new Set(remoteSets.map(s => s.id));
                for (const localSet of localSets) {
                    if (localSet.user_id === userId && !remoteIds.has(localSet.id)) {
                        await deleteLocalSet(localSet.id);
                    }
                }

                const sharedLocalSets = localSets.filter(s => s.user_id !== userId);
                const sharedLocalIds = sharedLocalSets.map(s => s.id);

                if (sharedLocalIds.length > 0) {
                    const { data: remoteSharedMeta, error: sharedErr } = await supabase
                        .from('Sets')
                        .select('id, title, description, folder, type, card_count, visibility, updated_at, created_at, user_id')
                        .in('id', sharedLocalIds);

                    if (!sharedErr && remoteSharedMeta) {
                        const activeSharedIds = new Set(remoteSharedMeta.map(s => s.id));

                        for (const id of sharedLocalIds) {
                            if (!activeSharedIds.has(id)) {
                                await deleteLocalSet(id);
                            }
                        }

                        const idsNeedingFullFetch = [];
                        for (const remote of remoteSharedMeta) {
                            if (remote.visibility !== 'public') {
                                await deleteLocalSet(remote.id);
                                continue;
                            }
                            const local = sharedLocalSets.find(s => s.id === remote.id);
                            if (!local || remote.updated_at > (local.updated_at || '')) {
                                if (local && local.cards) {
                                    idsNeedingFullFetch.push(remote.id);
                                } else {
                                    await saveLocalSet(remote);
                                }
                            }
                        }

                        if (idsNeedingFullFetch.length > 0) {
                            const { data: fullSets, error: fullErr } = await supabase
                                .from('Sets')
                                .select('*, Cards(*)')
                                .in('id', idsNeedingFullFetch);
                            if (!fullErr && fullSets) {
                                for (const fullSet of fullSets) {
                                    if (fullSet.Cards) {
                                        fullSet.cards = fullSet.Cards;
                                        delete fullSet.Cards;
                                    }
                                    if (fullSet.cards) {
                                        fullSet.cards.sort((a, b) => (a.position || 0) - (b.position || 0));
                                    }
                                    await saveLocalSet(sanitizeSharedSet(fullSet));
                                }
                            }
                        }
                    }
                }

                const setsNeedingUpdate = [];
                for (const remote of remoteSets) {
                    const local = localSets.find(s => s.id === remote.id);
                    if (!local || remote.updated_at > (local.updated_at || '')) {
                        setsNeedingUpdate.push(remote.id);
                    }
                }

                if (setsNeedingUpdate.length > 0) {
                    const { data: updatedSets, error: updateError } = await supabase
                        .from('Sets')
                        .select('id, title, description, folder, type, card_count, visibility, updated_at, created_at, user_id')
                        .in('id', setsNeedingUpdate);

                    if (!updateError && updatedSets && updatedSets.length > 0) {
                        await saveLocalSets(updatedSets);
                    }
                }
            }
        } catch (e) {
            console.error(e);
            Toast.show(`Fout bij synchronisatie: ${e.message}`, 'error');
        }
    }

    const finalSets = await getLocalSets();
    return finalSets.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

export async function getSetWithCards(supabase, setId, userId) {
    let localSet = await getLocalSet(setId);
    
    if (!navigator.onLine) return localSet;

    try {
        const { data: setMeta, error: metaErr } = await supabase
            .from('Sets')
            .select('user_id, visibility, updated_at')
            .eq('id', setId)
            .maybeSingle();

        if (!metaErr && !setMeta) {
            await deleteLocalSet(setId);
            return null;
        }

        if (setMeta && setMeta.user_id !== userId && setMeta.visibility !== 'public') {
            await deleteLocalSet(setId);
            return null;
        }

        // Skip full fetch if local data is up-to-date
        const needsFetch = !localSet || !localSet.cards ||
            (!metaErr && setMeta && (!localSet.updated_at || setMeta.updated_at > localSet.updated_at));

        if (needsFetch) {
            const { data: fullSet, error } = await supabase
                .from('Sets')
                .select('*, Cards(*)')
                .eq('id', setId)
                .single();
            if (!error && fullSet) {
                if (fullSet.Cards) {
                    fullSet.cards = fullSet.Cards;
                    delete fullSet.Cards;
                }
                if (fullSet.cards) {
                    fullSet.cards.sort((a, b) => (a.position || 0) - (b.position || 0));
                }
                localSet = fullSet.user_id !== userId ? sanitizeSharedSet(fullSet) : fullSet;
                await saveLocalSet(localSet);
            }
        }
    } catch (e) {
        console.error(e);
        Toast.show(`Fout bij ophalen set: ${e.message}`, 'error');
    }
    
    return localSet;
}

export async function syncSetToRemote(supabase, dbPayload, setId = null) {
    const cards = dbPayload.cards || [];
    const setPayload = { ...dbPayload };
    delete setPayload.cards;

    if (setId) {
        const { error: updateError } = await supabase.from('Sets').update(setPayload).eq('id', setId);
        if (updateError) throw updateError;
        
        const { data: currentCards, error: getCardsError } = await supabase
            .from('Cards')
            .select('id')
            .eq('set_id', setId);
        
        if (getCardsError) throw getCardsError;

        const newCardIds = new Set(cards.map(c => c.id).filter(id => id !== undefined && id !== null));
        const deleteIds = currentCards.map(c => c.id).filter(id => !newCardIds.has(id));
        if (deleteIds.length > 0) {
            const { error: deleteError } = await supabase.from('Cards').delete().in('id', deleteIds);
            if (deleteError) throw deleteError;
        }

        if (cards.length > 0) {
            const upsertPayload = cards.map((card, index) => {
                const row = {
                    set_id: setId,
                    term: card.term,
                    definition: card.definition,
                    starred: !!card.starred,
                    position: index
                };
                if (card.id) {
                    row.id = card.id;
                }
                return row;
            });
            const { data: upsertedData, error: upsertError } = await supabase
                .from('Cards')
                .upsert(upsertPayload)
                .select('id, term, definition, starred, position');
            
            if (upsertError) throw upsertError;

            if (upsertedData) {
                upsertedData.sort((a, b) => a.position - b.position);
                dbPayload.cards = upsertedData;
            }
        } else {
            dbPayload.cards = [];
        }

        dbPayload.id = setId;
        const existingSet = await getLocalSet(setId);
        const mergedPayload = existingSet ? { ...existingSet, ...dbPayload } : dbPayload;
        await saveLocalSet(mergedPayload);
    } else {
        const { data, error: insertError } = await supabase.from('Sets').insert([setPayload]).select('id, created_at, updated_at').single();
        if (insertError) throw insertError;
        
        const newSetId = data.id;

        if (cards.length > 0) {
            const cardsPayload = cards.map((card, index) => ({
                set_id: newSetId,
                term: card.term,
                definition: card.definition,
                starred: !!card.starred,
                position: index
            }));

            const { data: insertedCards, error: cardsInsertError } = await supabase
                .from('Cards')
                .insert(cardsPayload)
                .select('id, term, definition, starred, position');

            if (cardsInsertError) throw cardsInsertError;

            if (insertedCards) {
                insertedCards.sort((a, b) => a.position - b.position);
                dbPayload.cards = insertedCards;
            }
        } else {
            dbPayload.cards = [];
        }

        dbPayload.id = newSetId;
        dbPayload.created_at = data.created_at;
        dbPayload.updated_at = data.updated_at;
        await saveLocalSet(dbPayload);
    }
}

export async function syncSetPartialToRemote(supabase, setId, fields) {
    fields.updated_at = new Date().toISOString();
    const { error } = await supabase.from('Sets').update(fields).eq('id', setId);
    if (error) throw error;
    const existingSet = await getLocalSet(setId);
    if (existingSet) {
        await saveLocalSet({ ...existingSet, ...fields });
    }
}