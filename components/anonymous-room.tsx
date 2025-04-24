"use client";

import { useEffect, useState, useRef } from "react";
import {
  Room,
  LocalParticipant,
  RoomEvent,
  Track,
} from "livekit-client";
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

      await room.connect(serverUrl, token, { autoSubscribe: false });

      room
        .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
        .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
        .on(RoomEvent.Disconnected, handleDisconnect);
      
      // 1) для треков, которые будут публиковаться ПОСЛЕ вашего входа
      room.on(RoomEvent.TrackPublished, async (publication /* RemoteTrackPublication */) => {
        if (publication.kind === Track.Kind.Audio && !publication.isSubscribed) {
          try {
            await publication.setSubscribed(true);   // ← новый способ
          } catch (e) {
            console.error("subscribe error", e);
          }
        }
      });
      // 2) для треков, которые УЖЕ опубликованы к моменту вашего входа
      room.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach(async (pub) => {
          if (pub.kind === Track.Kind.Audio && !pub.isSubscribed) {
            try {
              await pub.setSubscribed(true);         // ← тоже через publication
            } catch (e) {
              console.error("initial subscribe error", e);
            }
          }
        });
      });
      // слушаем успех подписки и монтируем элемент
      room.on(RoomEvent.TrackSubscribed,
        (track /* RemoteTrack */, publication) => {
          if (track.kind === Track.Kind.Audio) {
            document.body.appendChild(track.attach());
          }
      });

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

    const pitchShift = new Tone.PitchShift(Math.random() * 4 + 10);
    const distortion = new Tone.Distortion(0.6); // Искажение тембра
    const bitCrusher = new Tone.BitCrusher(4); // Эффект цифрового "шума"
    const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.4 }); // Пространственный эффект
    const autoWah = new Tone.AutoWah({
      baseFrequency: 400,
      octaves: 4,
      sensitivity: -30,
    });

    const dest = Tone.getContext().createMediaStreamDestination();

    mic.connect(pitchShift);
    pitchShift.connect(dest);
    distortion.connect(bitCrusher);
    bitCrusher.connect(autoWah);
    autoWah.connect(reverb);
    reverb.connect(dest);

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