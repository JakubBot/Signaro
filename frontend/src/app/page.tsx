"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import WebRtc from "@/components/WebRTC/main";
import Navbar from "@/components/navbar/main";

export default function Home() {
  // https://chatgpt.com/c/689dcbe6-468c-832e-aa06-2d382cac3cb6

  return (
    <>
      <Navbar />
      <WebRtc />
    </>
  );
}
