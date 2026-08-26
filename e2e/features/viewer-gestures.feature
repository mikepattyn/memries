Feature: Photo viewer gestures
  A horizontal swipe past a short threshold moves to the next or
  previous Photo. A short drag snaps back. A downward drag dismisses
  the viewer.

  Scenario: Swiping left opens the next photo
    Given I am signed in
    When I open the photo from "Monday, 31 August 2026"
    And I swipe the viewer left
    Then the viewer shows the photo from "Wednesday, 26 August 2026"

  Scenario: A short drag snaps back
    Given I am signed in
    When I open the photo from "Monday, 31 August 2026"
    And I drag the viewer a short way left
    Then the viewer shows the photo from "Monday, 31 August 2026"

  Scenario: Dragging down closes the viewer
    Given I am signed in
    When I open the photo from "Monday, 31 August 2026"
    And I drag the viewer down to dismiss
    Then the photo viewer is closed

  @future @skip
  Scenario: Double-tap zooms the original
    Given I am signed in
    When I open the photo from "Monday, 31 August 2026"
    And I double-tap the viewer original
    Then the viewer original is zoomed

  @future @skip
  Scenario: Pinch opens zoom on the original
    Given I am signed in
    When I open the photo from "Monday, 31 August 2026"
    And I pinch the viewer original
    Then the viewer original is zoomed
