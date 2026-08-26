Feature: Index run splash
  Syncing the folder shows the Index run splash, then returns to
  Memories. A missing Original is pruned; a relocated Photo keeps its
  identity.

  Scenario: Sync folder shows the Index run then memories
    Given I am signed in
    When I start a folder sync
    Then I should see the Index run splash
    And I should see my memories

  Scenario: A missing original is pruned after Sync
    Given I am signed in
    When I remove the photo "july.jpg"
    And I sync the folder
    Then I should not see a memory from "Wednesday, 15 July 2026"
    And I should see a memory from "Monday, 31 August 2026"

  Scenario: Relocating a photo keeps favorite after Sync
    Given I am signed in
    When I open the photo from "Monday, 31 August 2026"
    And I add the viewer photo to favorites
    And I close the photo viewer
    And I relocate the photo "path.jpg" to "moved.jpg"
    And I sync the folder
    Then I should see a memory from "Monday, 31 August 2026"
    And the photo from "Monday, 31 August 2026" should be a favorite

  @future @skip
  Scenario: A failed Index run can be retried
    Given the Index run has failed
    When I am signed in
    Then I should see the Index run splash
    When I retry the Index run
    Then I should see my memories
