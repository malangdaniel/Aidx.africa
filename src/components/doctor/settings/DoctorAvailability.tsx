import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Video, Phone, MessageSquare, Clock, Calendar, AlertCircle } from "lucide-react";

interface DoctorAvailabilityProps {
  data: {
    consultationModes: string[];
    availableDays: string[];
    workingHoursStart: string;
    workingHoursEnd: string;
    timezone: string;
    avgResponseTime: string;
    maxConsultationsPerDay: string;
    emergencyAvailable: boolean;
    onCallStatus: boolean;
    consultPrice: string;
  };
  onChange: (field: string, value: any) => void;
}

const CONSULTATION_MODES = [
  { id: "chat", label: "Chat", icon: MessageSquare, description: "Text-based consultations" },
  { id: "audio", label: "Audio Call", icon: Phone, description: "Voice consultations" },
  { id: "video", label: "Video Call", icon: Video, description: "Face-to-face video consultations" }
];

const DAYS_OF_WEEK = [
  { id: "monday", label: "Mon" },
  { id: "tuesday", label: "Tue" },
  { id: "wednesday", label: "Wed" },
  { id: "thursday", label: "Thu" },
  { id: "friday", label: "Fri" },
  { id: "saturday", label: "Sat" },
  { id: "sunday", label: "Sun" }
];

const TIMEZONES = [
  "Africa/Lagos (WAT)",
  "Africa/Johannesburg (SAST)",
  "Europe/London (GMT/BST)",
  "America/New_York (EST/EDT)",
  "America/Los_Angeles (PST/PDT)",
  "Asia/Dubai (GST)",
  "Asia/Singapore (SGT)"
];

const RESPONSE_TIMES = [
  "Within 15 minutes",
  "Within 30 minutes",
  "Within 1 hour",
  "Within 2 hours",
  "Within 4 hours",
  "Within 24 hours"
];

export function DoctorAvailability({ data, onChange }: DoctorAvailabilityProps) {
  const toggleMode = (mode: string) => {
    if (data.consultationModes.includes(mode)) {
      onChange("consultationModes", data.consultationModes.filter(m => m !== mode));
    } else {
      onChange("consultationModes", [...data.consultationModes, mode]);
    }
  };

  const toggleDay = (day: string) => {
    if (data.availableDays.includes(day)) {
      onChange("availableDays", data.availableDays.filter(d => d !== day));
    } else {
      onChange("availableDays", [...data.availableDays, day]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Consultation Fee */}
      <div className="p-4 rounded-lg border bg-gradient-to-r from-primary/5 to-secondary/5">
        <Label className="text-base font-medium flex items-center gap-2">
          Consultation Fee
        </Label>
        <p className="text-sm text-muted-foreground mb-3">Set your standard consultation fee</p>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-muted-foreground">₦</span>
          <Input
            type="number"
            placeholder="5000"
            value={data.consultPrice}
            onChange={(e) => onChange("consultPrice", e.target.value)}
            className="max-w-[150px] text-lg font-semibold"
          />
        </div>
      </div>

      {/* Consultation Modes */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Consultation Modes</Label>
        <p className="text-sm text-muted-foreground">Select how patients can reach you</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CONSULTATION_MODES.map(mode => {
            const Icon = mode.icon;
            const isSelected = data.consultationModes.includes(mode.id);
            return (
              <div
                key={mode.id}
                className={`flex flex-col items-center p-4 rounded-lg border cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-primary bg-primary/10 shadow-sm' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
                onClick={() => toggleMode(mode.id)}
              >
                <Icon className={`h-8 w-8 mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`font-medium ${isSelected ? 'text-primary' : ''}`}>{mode.label}</span>
                <span className="text-xs text-muted-foreground text-center mt-1">{mode.description}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Available Days */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Available Days
        </Label>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map(day => (
            <Badge
              key={day.id}
              variant={data.availableDays.includes(day.id) ? "default" : "outline"}
              className="cursor-pointer px-4 py-2 text-sm transition-all hover:scale-105"
              onClick={() => toggleDay(day.id)}
            >
              {day.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Working Hours */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Working Hours
        </Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="workingHoursStart" className="text-sm text-muted-foreground">Start Time</Label>
            <Input
              id="workingHoursStart"
              type="time"
              value={data.workingHoursStart}
              onChange={(e) => onChange("workingHoursStart", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workingHoursEnd" className="text-sm text-muted-foreground">End Time</Label>
            <Input
              id="workingHoursEnd"
              type="time"
              value={data.workingHoursEnd}
              onChange={(e) => onChange("workingHoursEnd", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Timezone and Response */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="timezone">Time Zone</Label>
          <Select value={data.timezone} onValueChange={(v) => onChange("timezone", v)}>
            <SelectTrigger id="timezone">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map(tz => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="avgResponseTime">Average Response Time</Label>
          <Select value={data.avgResponseTime} onValueChange={(v) => onChange("avgResponseTime", v)}>
            <SelectTrigger id="avgResponseTime">
              <SelectValue placeholder="Select response time" />
            </SelectTrigger>
            <SelectContent>
              {RESPONSE_TIMES.map(rt => (
                <SelectItem key={rt} value={rt}>{rt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Max Consultations */}
      <div className="space-y-2">
        <Label htmlFor="maxConsultations">Maximum Consultations Per Day</Label>
        <Input
          id="maxConsultations"
          type="number"
          placeholder="10"
          min="1"
          max="50"
          value={data.maxConsultationsPerDay}
          onChange={(e) => onChange("maxConsultationsPerDay", e.target.value)}
          className="max-w-[150px]"
        />
        <p className="text-xs text-muted-foreground">Limit bookings to manage your schedule</p>
      </div>

      {/* Emergency and On-call */}
      <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <Label htmlFor="emergencyAvailable" className="font-medium">Emergency Availability</Label>
              <p className="text-sm text-muted-foreground">Accept urgent out-of-hours cases</p>
            </div>
          </div>
          <Switch
            id="emergencyAvailable"
            checked={data.emergencyAvailable}
            onCheckedChange={(checked) => onChange("emergencyAvailable", checked)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <Label htmlFor="onCallStatus" className="font-medium">On-Call Status</Label>
              <p className="text-sm text-muted-foreground">Show as currently available for calls</p>
            </div>
          </div>
          <Switch
            id="onCallStatus"
            checked={data.onCallStatus}
            onCheckedChange={(checked) => onChange("onCallStatus", checked)}
          />
        </div>
      </div>
    </div>
  );
}
