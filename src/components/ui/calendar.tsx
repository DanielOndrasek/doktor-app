import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Převzato z vividbooks CRM (`831f9ae6`), přepsané na react-day-picker v9.
 * CRM běží na v8, která nepodporuje React 19 — jména tříd (`day_selected`
 * → `selected`, `head_cell` → `weekday`, …) i tvar `components` se v9 mění,
 * vzhled zůstává stejný. Viz `docs/prevzeti-z-vividbooks.md`.
 */
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, fixedWeeks = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center h-7",
        caption_label: "text-sm font-medium",
        nav: "flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-4 top-4 z-10 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-4 top-4 z-10 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        dropdowns: "flex justify-center gap-1",
        dropdown:
          "h-7 rounded-md border border-input bg-transparent pl-2 pr-1 text-sm font-medium outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_start: "rounded-l-md bg-accent",
        range_middle:
          "bg-accent [&>button]:bg-transparent [&>button]:text-accent-foreground [&>button:hover]:bg-transparent",
        range_end: "rounded-r-md bg-accent",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" {...chevronProps} />
          ) : (
            <ChevronRight className="h-4 w-4" {...chevronProps} />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
