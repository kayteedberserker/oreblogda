import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUserModel from "@/app/models/MobileUserModel";

export async function GET(req) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const fingerprint = searchParams.get("fingerprint");

  if (!fingerprint) return NextResponse.json({ message: "No ID" }, { status: 400 });

  try {
    // 1. Find the user and use .lean() for maximum read performance
    let user = await MobileUserModel.findOne({ deviceId: fingerprint }).lean();
    
    if (!user) {
      let randNum = Math.floor(Math.random() * 10000000);
      // If they don't exist in DB yet, create them now
      const newUser = await MobileUserModel.create({ deviceId: fingerprint, username: `User${randNum}` });
      // Convert to a plain object so it matches the .lean() output format
      user = newUser.toObject(); 
    } else {
      // ⚡️ --- NEW: LAZY DELETION FOR EXPIRED INVENTORY --- ⚡️
      // Only run this if the user already existed and has an inventory
      if (user.inventory && Array.isArray(user.inventory)) {
          const now = new Date();
          let inventoryNeedsUpdate = false;

          // Filter out any items that have an expiration date that has passed
          const validInventory = user.inventory.filter(item => {
              if (item.expiresAt && new Date(item.expiresAt) < now) {
                  inventoryNeedsUpdate = true; // Found a dead item
                  return false; // Remove it
              }
              return true; // Keep it
          });

          // If we removed anything, quietly update the database in the background
          if (inventoryNeedsUpdate) {
              await MobileUserModel.updateOne(
                  { _id: user._id },
                  { $set: { inventory: validInventory } }
              );
              
              // Update the in-memory object before sending it to the app
              user.inventory = validInventory;
          }
      }
    }

    // Return the clean user profile
    return NextResponse.json(user, { status: 200 });
  } catch (err) {
    console.error("User Context Fetch Error:", err);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}