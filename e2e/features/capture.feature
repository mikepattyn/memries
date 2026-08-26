Feature: Capture time
  Indexed photos sort by capture time, newest first. EXIF DateTimeOriginal
  wins; a file with no EXIF falls back to filesystem time.

  Scenario: EXIF order is newest first and no-EXIF uses file time
    Given I am signed in
    Then memories should appear in this capture order:
      | Monday, 31 August 2026     |
      | Wednesday, 26 August 2026  |
      | Tuesday, 25 August 2026    |
      | Monday, 24 August 2026     |
      | Wednesday, 19 August 2026  |
      | Wednesday, 15 July 2026    |
      | Wednesday, 10 June 2026    |
      | Sunday, 12 April 2026      |
      | Saturday, 20 December 2025 |
      | Wednesday, 8 October 2025  |
      | Wednesday, 15 March 2023   |

  Scenario: Sync after capture metadata change keeps favorite and album
    Given I am signed in
    When I create an album named "Keep"
    And I open the "Memories" tab
    When I open the photo from "Monday, 31 August 2026"
    And I add the viewer photo to favorites
    And I add the viewer photo to album "Keep"
    And I close the photo viewer
    And I change the capture date of "path.jpg" to "2026:06:01 10:00:00"
    And I sync the folder
    Then I should see a memory from "Monday, 1 June 2026"
    And the photo from "Monday, 1 June 2026" should be a favorite
    And the album "Keep" should have 1 photos
