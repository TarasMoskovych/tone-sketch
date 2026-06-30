# Requirements Document

## Introduction

This feature adds two visual enhancements to the homepage melody feed in Tone Sketch:
1. An audio visualizer that appears near a melody card when that song is actively playing (homepage only).
2. A duration display beneath the song title on each melody card, showing the total song length.

These additions improve the user experience by providing visual audio feedback during playback and giving users a sense of each melody's length before playing it.

## Glossary

- **Audio_Visualizer**: A real-time animated component that renders frequency or waveform data from the currently playing audio as a visual bar or wave graphic.
- **MelodyCard**: The UI component representing a single melody in the homepage feed, displaying title, creation date, and playback controls.
- **MelodyFeed**: The scrollable list of MelodyCard components on the homepage.
- **Feed_Preview**: The playback system managed by the useFeedPreview hook that handles audio preview of melodies in the feed.
- **Duration_Display**: A text element showing the total playback time of a melody formatted as minutes and seconds (e.g., "1:23").
- **MelodySummary**: The data type representing a melody in the feed list, containing id, title, and createdAt fields.
- **Tone_Analyzer**: A Tone.js analyser node that provides real-time frequency or waveform data from the audio output.

## Requirements

### Requirement 1: Compute and Expose Melody Duration

**User Story:** As a user browsing the feed, I want to see how long each melody is, so that I can decide whether to listen based on length.

#### Acceptance Criteria

1. WHEN the API returns melody summaries for the feed, THE MelodySummary type SHALL include a durationSeconds field of type number representing the total melody duration in seconds, rounded to two decimal places.
2. WHEN computing melody duration, THE API SHALL calculate it as the maximum of (note start + note duration) across all notes, divided by the tempo in beats per minute, multiplied by 60, and round the result to two decimal places.
3. IF a melody contains zero notes, THEN THE API SHALL return a durationSeconds value of 0.
4. IF a melody has a tempo value less than or equal to 0, THEN THE API SHALL return a durationSeconds value of 0.

### Requirement 2: Display Duration on Melody Cards

**User Story:** As a user browsing the homepage, I want to see the duration of each melody on its card, so that I know how long it will play before I click play.

#### Acceptance Criteria

1. THE MelodyCard SHALL display the melody duration below the melody title and above the creation date.
2. WHEN the duration is less than 60 seconds, THE MelodyCard SHALL format the duration as "0:SS" where SS is zero-padded seconds (e.g., "0:05", "0:42").
3. WHEN the duration is 60 seconds or greater and less than 3600 seconds, THE MelodyCard SHALL format the duration as "M:SS" where M is unpadded minutes (1-59) and SS is zero-padded seconds (e.g., "1:05", "12:30").
4. WHEN the duration is 3600 seconds or greater, THE MelodyCard SHALL format the duration as "H:MM:SS" where H is unpadded hours, MM is zero-padded minutes, and SS is zero-padded seconds (e.g., "1:02:30").
5. WHEN the durationSeconds value is 0, THE MelodyCard SHALL display "0:00" as the duration.
6. IF the durationSeconds value is undefined, null, negative, or zero, THEN THE MelodyCard SHALL always display "0:00" as the duration, overriding any other formatting rules.
7. THE Duration_Display SHALL use a smaller font size than the title and a lower-contrast text color than the title, matching the style weight of the creation date text.

### Requirement 3: Render Audio Visualizer for Playing Melody

**User Story:** As a user listening to a melody on the homepage, I want to see an audio visualizer near the playing card, so that I get real-time visual feedback of the sound.

#### Acceptance Criteria

1. WHILE a melody is playing in the Feed_Preview, THE Audio_Visualizer SHALL render animated frequency bars directly below the currently playing MelodyCard, spanning the full width of the card.
2. WHEN no melody is playing, THE Audio_Visualizer SHALL NOT be visible in the feed.
3. WHEN playback stops (user clicks stop or melody ends), THE Audio_Visualizer SHALL be removed from the DOM within one animation frame (approximately 16ms).
4. WHEN a different melody starts playing, THE Audio_Visualizer SHALL be removed from the previous MelodyCard and rendered below the newly playing MelodyCard.
5. THE Audio_Visualizer SHALL display a minimum of 16 and a maximum of 32 frequency bars, evenly spaced across the visualizer width.
6. THE Audio_Visualizer SHALL update its visualization at the display refresh rate using requestAnimationFrame.
7. THE Audio_Visualizer SHALL render with a fixed height between 32 and 48 pixels, where each bar height is scaled proportionally to its frequency bin amplitude (0 amplitude renders as 0 height, maximum amplitude renders as full visualizer height).
8. WHILE the audio output contains silence (all frequency amplitudes are zero), THE Audio_Visualizer SHALL render all bars at zero height (flat line).

### Requirement 4: Visualizer Data Source

**User Story:** As a developer, I want the visualizer to read real audio data from Tone.js, so that the visualization accurately represents what the user hears.

#### Acceptance Criteria

1. THE Audio_Visualizer SHALL obtain frequency data from a Tone_Analyzer node connected to the audio output of the Feed_Preview synthesizer.
2. WHEN the Feed_Preview synthesizer is initialized, THE Feed_Preview SHALL create a Tone_Analyzer node and connect it at the end of the synthesizer output chain (after effects and volume processing) so that analyzed data reflects the final audible output.
3. WHEN the Feed_Preview synthesizer disposal is attempted, THE Feed_Preview SHALL always disconnect and dispose the Tone_Analyzer node, even if the synthesizer disposal itself fails or is interrupted.
4. THE Tone_Analyzer SHALL use an FFT size of 64 to produce exactly 32 frequency bin values in the range 0 to 255 (unsigned 8-bit integers).
5. THE Feed_Preview hook SHALL expose a method or reference that allows the Audio_Visualizer to retrieve the current frequency bin data array from the Tone_Analyzer on each animation frame.
6. WHILE no audio is playing through the Feed_Preview synthesizer, THE Tone_Analyzer SHALL return frequency bin values of 0 for all 32 bins.
7. WHILE audio is actively playing through the Feed_Preview synthesizer, THE Tone_Analyzer SHALL return non-zero frequency bin values that reflect the actual audio content being produced.

### Requirement 5: Visualizer Rendering Performance

**User Story:** As a user, I want the visualizer to animate smoothly without causing jank, so that scrolling and interaction remain responsive.

#### Acceptance Criteria

1. THE Audio_Visualizer SHALL complete each canvas draw operation (reading frequency data from the Tone_Analyzer and painting bars to the canvas) within 16ms to maintain 60fps.
2. THE Audio_Visualizer SHALL use a canvas element for rendering frequency bars to minimize DOM manipulation.
3. WHEN the MelodyCard containing the Audio_Visualizer becomes fully outside the viewport (0% intersection), THE Audio_Visualizer SHALL pause its animation loop by cancelling the active requestAnimationFrame callback.
4. WHEN the MelodyCard containing the Audio_Visualizer transitions from fully outside the viewport (0% intersection) to any part being visible (intersection ratio greater than 0), THE Audio_Visualizer SHALL resume its animation loop immediately upon the intersection change, without waiting for an additional measurement update.
5. IF a single render frame exceeds 16ms, THEN THE Audio_Visualizer SHALL skip that frame's visual update and proceed to the next requestAnimationFrame callback without queuing additional frames.
6. THE Audio_Visualizer canvas element SHALL match the width of its parent container and maintain a fixed height of 48 pixels.

### Requirement 6: Visualizer Scope Limitation

**User Story:** As a developer, I want the visualizer to only appear on the homepage feed, so that it does not interfere with other pages like the melody editor.

#### Acceptance Criteria

1. THE Audio_Visualizer may only render within the MelodyFeed component on the homepage route (/), but is not required to be visible at all times on the homepage.
2. THE Audio_Visualizer SHALL NOT render on any route other than the homepage, including the melody detail page (/m/[id]) and the create page (/create).
3. WHEN navigating away from the homepage while a melody is playing, THE Audio_Visualizer SHALL be unmounted from the DOM and its requestAnimationFrame loop cancelled within one animation frame of the route change.
4. WHEN the user navigates back to the homepage after previously navigating away, THE Audio_Visualizer SHALL NOT resume any prior animation state and SHALL only render again if a melody is actively playing in the Feed_Preview. These constraints apply only during the navigation-back event and do not impose general system rules.

### Requirement 7: Visualizer Accessibility

**User Story:** As a user with assistive technology, I want the visualizer to not interfere with screen reader navigation, so that the feed remains accessible.

#### Acceptance Criteria

1. THE Audio_Visualizer canvas element SHALL have aria-hidden set to true.
2. THE Audio_Visualizer canvas element SHALL have tabindex set to -1 so that it does not receive keyboard focus during tab navigation.
3. THE Audio_Visualizer SHALL NOT contain any ARIA live regions, roles, or labels that introduce content into the accessibility tree.
4. WHILE the Audio_Visualizer is rendered, THE MelodyCard's existing aria-live announcements for playing state and loading state SHALL continue to be announced by screen readers without being suppressed or duplicated.
