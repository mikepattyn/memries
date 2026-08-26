Feature: Photo viewer keyboard
  The viewer is a dialog. Escape closes it, arrows move through the
  list, F toggles favorite, and Tab stays inside. Closing returns
  focus to the Photo that opened it.

  Scenario: Escape closes the viewer
    Given I am signed in
    When I open the photo from "Monday, 31 August 2026"
    And I press "Escape"
    Then the photo viewer is closed

  Scenario: Escape closes the album picker first
    Given I am signed in
    When I create an album named "Keys"
    And I open the "Memories" tab
    And I open the photo from "Monday, 31 August 2026"
    And I open the viewer album picker
    Then the photo actions menu is visible
    When I press "Escape"
    Then the photo actions menu is closed
    And the photo viewer is open

  Scenario: Arrow keys move through the list
    Given I am signed in
    When I open the photo from "Monday, 31 August 2026"
    Then the viewer shows the photo from "Monday, 31 August 2026"
    When I press "ArrowRight"
    Then the viewer shows the photo from "Wednesday, 26 August 2026"
    When I press "ArrowLeft"
    Then the viewer shows the photo from "Monday, 31 August 2026"

  Scenario: F toggles favorite
    Given I am signed in
    When I open the photo from "Monday, 31 August 2026"
    And I press "f"
    Then the viewer photo is a favorite
    When I press "F"
    Then the viewer photo is not a favorite

  Scenario: Tab stays inside the viewer
    Given I am signed in
    When I open the photo from "Monday, 31 August 2026"
    And I press "Shift+Tab"
    Then focus stays inside the photo viewer

  Scenario: Closing returns focus to the photo card
    Given I am signed in
    When I open the photo from "Monday, 31 August 2026"
    And I close the photo viewer
    Then the photo from "Monday, 31 August 2026" is focused
