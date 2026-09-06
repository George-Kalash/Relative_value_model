# Chart contract

Surface: the project's React application, using Recharts. Data comes only from
normalized Yahoo daily bars and the versioned monitor API snapshot.

| View | Question | Encoding | Coverage / fallback |
| --- | --- | --- | --- |
| Ranking score bars | Which pair is furthest from its own history? | Diverging bar centered on zero, fixed ±4 display range, exact signed score label; clipped bars explicitly titled | Eligible rows only; ineligible scores display an em dash |
| Price history | How did the pair move relative to its rolling baseline? | Two daily lines: cyan close, dashed violet baseline; quote currency units; focused price axis | Up to 252 sessions, at least 8 observations; empty state when insufficient |
| Z-score history | How unusual is the current deviation over time? | Cyan daily line, neutral zero and ±2 reference lines; standard-deviation units | Same sessions and baseline as ranking; gaps remain disconnected |

The two time-series charts answer different daily-history questions. No live
quote is appended to either daily chart. Time axes use actual dates and tooltips
show full dates and precise values. Dark charts match the surrounding application;
cyan/violet distinguish comparison series and line dashes preserve distinction
without colour. Per the user's requested terminal palette, signed values and
score bars use green for positive, red for negative, and gray for displayed zero.
Percentage values that round to 0.00% are neutral and have no positive/negative
sign. Orange accents mark interface controls, selection, and section headers;
they do not encode return direction. Absolute prices, volatility, and counts
retain neutral text because they do not express a directional change.
Charts use the same
snapshot ID as the selected ranking row. Range controls change only the displayed
history; baseline controls recalculate the entire monitor.
