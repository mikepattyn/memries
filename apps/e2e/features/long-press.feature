Feature: Long-press photo actions
  Long-press offers album rows (name left, count right). Tapping a row
  adds the Photo once.

  Scenario: Album row layout and idempotent add
    Given I am signed in
    When I create an album named "Hold"
    And I open the "Memories" tab
    And I long-press the photo from "Monday, 31 August 2026"
    Then the photo actions menu is visible
    And album "Hold" in the actions menu shows 0 on the right
    When I choose album "Hold" in the actions menu
    Then the album "Hold" should have 1 photos
    When I open the "Memories" tab
    And I long-press the photo from "Monday, 31 August 2026"
    And I choose album "Hold" in the actions menu
    Then the album "Hold" should have 1 photos
