"use client";

import { useEffect, useState, useRef } from "react";
import { Room, LocalParticipant, RoomEvent, Track } from "livekit-client";
import * as Tone from "tone";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnonymousRoomProps {
  token: string;
  serverUrl: string;
}

export const AnonymousRoom = ({ token, serverUrl }: AnonymousRoomProps) => {
  const roomRef = useRef<Room | null>(null);
  const [audioPublished, setAudioPublished] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const micInstanceRef = useRef<Tone.UserMedia | null>(null);

  // Подключение к комнате и автопубликация микрофона
  useEffect(() => {
    const connectToRoom = async () => {
      const room = new Room();
      roomRef.current = room;

      await room.connect(serverUrl, token);

      room
        .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
        .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
        .on(RoomEvent.Disconnected, handleDisconnect);

      // Автоматически публикуем микрофон с изменением голоса
      await publishAudio(room.localParticipant);
    };

    connectToRoom();

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }

      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
      }

      if (micInstanceRef.current) {
        micInstanceRef.current.close();
      }
    };
  }, [token, serverUrl]);

  const handleTrackSubscribed = (track: Track) => {
    if (track.kind === "audio") {
      const audioElement = track.attach();
      document.body.appendChild(audioElement);
    }
  };

  const handleTrackUnsubscribed = (track: Track) => {
    track.detach();
  };

  const handleDisconnect = () => {
    console.log("disconnected from room");
  };

  const publishAudio = async (participant: LocalParticipant) => {
    if (audioPublished) return;

    await Tone.start();

    const mic = new Tone.UserMedia();
    await mic.open();
    micInstanceRef.current = mic;

    const pitchShift = new Tone.PitchShift(12);
    const dest = Tone.getContext().createMediaStreamDestination();

    mic.connect(pitchShift);
    pitchShift.connect(dest);

    const [processedTrack] = dest.stream.getAudioTracks();
    audioTrackRef.current = processedTrack;

    await participant.publishTrack(processedTrack);

    setAudioPublished(true);
    setIsMicEnabled(true);
  };

  const toggleMic = () => {
    if (audioTrackRef.current) {
      audioTrackRef.current.enabled = !audioTrackRef.current.enabled;
      setIsMicEnabled(audioTrackRef.current.enabled);
    }
  };

  return (
    <div className="flex flex-col items-center h-full">
      <User className="h-[80%] w-[30%]" />
      {audioPublished && (
        <Button onClick={toggleMic}>
          {isMicEnabled ? "Выключить микрофон" : "Включить микрофон"}
        </Button>
      )}
    </div>
  );
};
