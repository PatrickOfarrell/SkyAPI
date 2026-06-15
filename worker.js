export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const username = url.searchParams.get("username");

    if (!username) {
      return new Response(JSON.stringify({ error: "Missing username" }), { 
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    const cacheKey = `sb-user-${username.toLowerCase()}`;
    const cachedData = await env.SKYBLOCK_CACHE.get(cacheKey);
    
    if (cachedData) {
      return new Response(cachedData, {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Cache": "HIT"
        }
      });
    }

    try {
      const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
      if (!mojangRes.ok) {
        return new Response(JSON.stringify({ error: "Minecraft account not found" }), {
          status: 404,
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      }
      const mojangData = await mojangRes.json();
      const uuid = mojangData.id;
      const cleanName = mojangData.name;

      const hypixelUrl = `https://api.hypixel.net/v2/skyblock/profiles?uuid=${uuid}`;
      const response = await fetch(hypixelUrl, {
        headers: { 
          "API-Key": env.HYPIXEL_API_KEY,
          "Accept": "application/json"
        }
      });

      const data = await response.json();
      if (!data.success || !data.profiles || data.profiles.length === 0) {
        return new Response(JSON.stringify({ error: "No Skyblock profiles found" }), {
          status: 404,
          headers: { "Access-Control-Allow-Origin": "*" }
        });
      }

      const activeProfile = data.profiles.find(p => p.selected === true) || data.profiles[0];
      const memberData = activeProfile.members[uuid];

      const structuredResult = {
        name: cleanName,
        uuid: uuid,
        profileName: activeProfile.cute_name,
        gameMode: activeProfile.game_mode || "Normal",
        skyblockLevel: (memberData.leveling?.experience ?? 0) / 100, 
        purse: memberData.currencies?.purse ?? 0,
        bank: activeProfile.banking?.balance ?? 0,
        petsCount: memberData.pets_data?.pets?.length ?? 0,
        hasInventoryData: !!memberData.inventory?.inv_contents,
        hasArmorData: !!memberData.inventory?.armor_contents
      };

      const finalResponseString = JSON.stringify(structuredResult);
      await env.SKYBLOCK_CACHE.put(cacheKey, finalResponseString, { expirationTtl: 300 });

      return new Response(finalResponseString, {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Cache": "MISS"
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
